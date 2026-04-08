const { addPlayer, createInitialState } = require("./engine/game-engine.cjs");
const { createEngineContentStore } = require("./engine-content-store.cjs");
const { STANDARD_DICE_RULE_SET_ID, findCombatRuleDefinition } = require("../shared/dice.cjs");
const {
  DEFAULT_PIECE_THEME_ID,
  DEFAULT_RULE_MODIFIER_ID,
  DEFAULT_VICTORY_RULE_ID,
  createResolvedGameConfig,
  seedGameRulesets,
  seedMapDefinitions,
  seedPieceThemes,
  seedVictoryRules
} = require("../shared/engine-definitions.cjs");
const { secureRandom } = require("./random.cjs");
const { createLocalizedError } = require("../shared/messages.cjs");

const AI_GENERAL_NAMES = [
  "Caesar",
  "Hannibal",
  "Scipio",
  "Belisarius",
  "Saladin",
  "Subutai",
  "Marlborough",
  "Suvorov",
  "Wellington",
  "Napoleon",
  "Kutuzov",
  "Grant"
];

function normalizePlayerType(value) {
  return value === "ai" ? "ai" : "human";
}

function buildHistoricalAiNames(count, random = secureRandom) {
  const pool = AI_GENERAL_NAMES.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const names = [];
  for (let index = 0; index < count; index += 1) {
    if (index < pool.length) {
      names.push(pool[index]);
    } else {
      names.push("CPU " + (index + 1));
    }
  }

  return names;
}

function validatePlayerConfiguration(input = {}, options = {}) {
  const totalPlayers = input.totalPlayers == null ? 2 : Number(input.totalPlayers);
  if (!Number.isInteger(totalPlayers) || totalPlayers < 2 || totalPlayers > 4) {
    throw createLocalizedError("Il numero totale di giocatori deve essere compreso tra 2 e 4.", "newGame.invalidTotalPlayers");
  }

  const requestedPlayers = Array.isArray(input.players)
    ? input.players
    : Array.from({ length: totalPlayers }, () => ({ type: "human" }));

  if (requestedPlayers.length !== totalPlayers) {
    throw createLocalizedError("Configura tutti gli slot giocatore prima di creare la partita.", "newGame.invalidPlayers");
  }

  const firstSlotType = normalizePlayerType(requestedPlayers[0] && requestedPlayers[0].type);
  if (firstSlotType !== "human") {
    throw createLocalizedError("Il giocatore 1 deve essere sempre il creatore umano.", "newGame.invalidCreatorSlot");
  }

  const aiCount = requestedPlayers.slice(1).filter((slot) => normalizePlayerType(slot && slot.type) === "ai").length;
  const aiNames = buildHistoricalAiNames(aiCount, options.random);
  let nextAiIndex = 0;

  const players = requestedPlayers.map((slot, index) => {
    const type = index === 0 ? "human" : normalizePlayerType(slot && slot.type);
    return {
      slot: index + 1,
      type,
      name: type === "ai" ? aiNames[nextAiIndex++] : null
    };
  });

  return {
    totalPlayers,
    players
  };
}

function resolveSeedRulesetBundle(input = {}) {
  const selectedGameRuleset = input.rulesetId || input.gameRulesetId
    ? seedGameRulesets.find((ruleset) => ruleset.id === String(input.rulesetId || input.gameRulesetId))
    : null;

  if ((input.rulesetId || input.gameRulesetId) && !selectedGameRuleset) {
    throw createLocalizedError("Il ruleset selezionato non e supportato.", "newGame.invalidRuleset");
  }

  const mapId = String(input.mapId || selectedGameRuleset?.mapId || "classic-mini");
  const pieceThemeId = String(input.pieceThemeId || selectedGameRuleset?.pieceThemeId || DEFAULT_PIECE_THEME_ID);
  const victoryRuleId = String(input.victoryRuleId || selectedGameRuleset?.victoryRuleId || DEFAULT_VICTORY_RULE_ID);
  const combatRuleId = String(input.combatRuleId || input.diceRuleSetId || selectedGameRuleset?.combatRuleId || STANDARD_DICE_RULE_SET_ID);
  const ruleModifierIds = Array.isArray(input.ruleModifierIds)
    ? input.ruleModifierIds.map((modifierId) => String(modifierId))
    : (selectedGameRuleset?.ruleModifierIds || [DEFAULT_RULE_MODIFIER_ID]);

  const selectedMap = seedMapDefinitions.find((map) => map.id === mapId) || null;
  if (!selectedMap) {
    throw createLocalizedError("La mappa selezionata non e supportata.", "newGame.invalidMap");
  }

  const selectedPieceTheme = seedPieceThemes.find((theme) => theme.id === pieceThemeId) || null;
  if (!selectedPieceTheme) {
    throw createLocalizedError("La pedina selezionata non e supportata.", "newGame.invalidPieceTheme");
  }

  const selectedVictoryRule = seedVictoryRules.find((rule) => rule.id === victoryRuleId) || null;
  if (!selectedVictoryRule) {
    throw createLocalizedError("La regola vittoria selezionata non e supportata.", "newGame.invalidVictoryRule");
  }

  const selectedCombatRule = findCombatRuleDefinition(combatRuleId);
  if (!selectedCombatRule) {
    throw createLocalizedError("La regola dadi selezionata non e supportata.", "newGame.invalidDiceRuleSet");
  }

  return {
    selectedGameRuleset: selectedGameRuleset || {
      id: null,
      name: "Custom Ruleset",
      mapId,
      pieceThemeId,
      victoryRuleId,
      combatRuleId,
      ruleModifierIds
    },
    selectedMap,
    selectedPieceTheme,
    selectedVictoryRule,
    selectedCombatRule,
    selectedRuleModifiers: ruleModifierIds.map((modifierId) => ({ id: modifierId })),
    resolvedGameConfig: createResolvedGameConfig({
      gameRuleset: selectedGameRuleset || null,
      map: selectedMap,
      pieceTheme: selectedPieceTheme,
      victoryRule: selectedVictoryRule,
      combatRule: selectedCombatRule,
      ruleModifiers: ruleModifierIds.map((modifierId) => ({ id: modifierId }))
    })
  };
}

function buildValidatedConfig(input = {}, options = {}, resolvedBundle) {
  const playerConfig = validatePlayerConfiguration(input, options);

  return {
    name: input.name,
    gameRulesetId: resolvedBundle.selectedGameRuleset.id || null,
    gameRulesetName: resolvedBundle.selectedGameRuleset.name || "Custom Ruleset",
    mapId: resolvedBundle.selectedMap.id,
    mapName: resolvedBundle.selectedMap.name,
    pieceThemeId: resolvedBundle.selectedPieceTheme.id,
    pieceThemeName: resolvedBundle.selectedPieceTheme.name,
    victoryRuleId: resolvedBundle.selectedVictoryRule.id,
    victoryRuleName: resolvedBundle.selectedVictoryRule.name,
    selectedMap: resolvedBundle.selectedMap,
    selectedPieceTheme: resolvedBundle.selectedPieceTheme,
    selectedVictoryRule: resolvedBundle.selectedVictoryRule,
    selectedCombatRule: resolvedBundle.selectedCombatRule,
    selectedRuleModifiers: resolvedBundle.selectedRuleModifiers,
    resolvedGameConfig: resolvedBundle.resolvedGameConfig,
    diceRuleSetId: resolvedBundle.selectedCombatRule.id,
    totalPlayers: playerConfig.totalPlayers,
    players: playerConfig.players
  };
}

async function validateNewGameConfigAsync(input = {}, options = {}) {
  const contentStore = options.contentStore || createEngineContentStore(options);
  const resolvedBundle = await contentStore.resolveRulesetBundle({
    ...input,
    ...(input.combatRuleId || input.diceRuleSetId
      ? { combatRuleId: input.combatRuleId || input.diceRuleSetId || STANDARD_DICE_RULE_SET_ID }
      : {})
  });
  return buildValidatedConfig(input, options, resolvedBundle);
}

function validateNewGameConfig(input = {}, options = {}) {
  return buildValidatedConfig(input, options, resolveSeedRulesetBundle(input));
}

async function createConfiguredInitialStateAsync(configInput = {}, options = {}) {
  const config = await validateNewGameConfigAsync(configInput, options);
  const state = createInitialState(config.selectedMap);
  state.diceRuleSetId = config.diceRuleSetId;
  state.gameRulesetId = config.gameRulesetId;
  state.pieceThemeId = config.pieceThemeId;
  state.resolvedGameConfig = config.resolvedGameConfig;
  state.gameConfig = {
    rulesetId: config.gameRulesetId,
    rulesetName: config.gameRulesetName,
    mapId: config.mapId,
    mapName: config.mapName,
    pieceThemeId: config.pieceThemeId,
    pieceThemeName: config.pieceThemeName,
    victoryRuleId: config.victoryRuleId,
    victoryRuleName: config.victoryRuleName,
    combatRuleId: config.diceRuleSetId,
    diceRuleSetId: config.diceRuleSetId,
    ruleModifierIds: config.selectedRuleModifiers.map((modifier) => modifier.id),
    totalPlayers: config.totalPlayers,
    players: config.players
  };

  config.players.forEach((player) => {
    if (player.type !== "ai") {
      return;
    }

    const result = addPlayer(state, player.name, { isAi: true });
    if (!result.ok) {
      throw createLocalizedError(result.error || "Impossibile aggiungere il giocatore AI.", result.errorKey || "newGame.addAiFailed", result.errorParams);
    }
  });

  return {
    state,
    gameInput: { name: config.name },
    config
  };
}

function createConfiguredInitialState(configInput = {}, options = {}) {
  const config = validateNewGameConfig(configInput, options);
  const state = createInitialState(config.selectedMap);
  state.diceRuleSetId = config.diceRuleSetId;
  state.gameRulesetId = config.gameRulesetId;
  state.pieceThemeId = config.pieceThemeId;
  state.resolvedGameConfig = config.resolvedGameConfig;
  state.gameConfig = {
    rulesetId: config.gameRulesetId,
    rulesetName: config.gameRulesetName,
    mapId: config.mapId,
    mapName: config.mapName,
    pieceThemeId: config.pieceThemeId,
    pieceThemeName: config.pieceThemeName,
    victoryRuleId: config.victoryRuleId,
    victoryRuleName: config.victoryRuleName,
    combatRuleId: config.diceRuleSetId,
    diceRuleSetId: config.diceRuleSetId,
    ruleModifierIds: config.selectedRuleModifiers.map((modifier) => modifier.id),
    totalPlayers: config.totalPlayers,
    players: config.players
  };

  config.players.forEach((player) => {
    if (player.type !== "ai") {
      return;
    }

    const result = addPlayer(state, player.name, { isAi: true });
    if (!result.ok) {
      throw createLocalizedError(result.error || "Impossibile aggiungere il giocatore AI.", result.errorKey || "newGame.addAiFailed", result.errorParams);
    }
  });

  return {
    state,
    gameInput: { name: config.name },
    config
  };
}

async function listGameOptions(options = {}) {
  const contentStore = options.contentStore || createEngineContentStore(options);
  const catalog = await contentStore.listCatalog();
  return {
    maps: catalog.maps.map((map) => ({
      id: map.id,
      name: map.name,
      territoryCount: map.territoryCount,
      continentCount: map.continentCount,
      continentBonuses: Array.isArray(map.continentBonuses) ? map.continentBonuses : []
    })),
    pieceThemes: catalog.pieceThemes,
    victoryRules: catalog.victoryRules,
    combatRules: catalog.combatRules,
    diceRuleSets: catalog.combatRules,
    gameRulesets: catalog.gameRulesets,
    ruleModifiers: catalog.ruleModifiers,
    modules: catalog.modules,
    playerRange: { min: 2, max: 4 }
  };
}

module.exports = {
  AI_GENERAL_NAMES,
  buildHistoricalAiNames,
  createConfiguredInitialState,
  createConfiguredInitialStateAsync,
  listGameOptions,
  validateNewGameConfig,
  validateNewGameConfigAsync
};
