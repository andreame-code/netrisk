const { addPlayer, createInitialState } = require("./engine/game-engine.cjs");
const { findDiceRuleSet, listDiceRuleSets, STANDARD_DICE_RULE_SET_ID } = require("../shared/dice.cjs");
const { createGameModeDefinition, listVictoryRules, findVictoryRule } = require("../shared/models.cjs");
const { findSupportedMap, listSupportedMaps } = require("../shared/maps/index.cjs");
const { findRuleModule, listRuleModules } = require("./engine/rule-modules/index.cjs");
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

function validateNewGameConfig(input = {}, options = {}) {
  const totalPlayers = input.totalPlayers == null ? 2 : Number(input.totalPlayers);
  if (!Number.isInteger(totalPlayers) || totalPlayers < 2 || totalPlayers > 4) {
    throw createLocalizedError("Il numero totale di giocatori deve essere compreso tra 2 e 4.", "newGame.invalidTotalPlayers");
  }

  const mapId = String(input.mapId || "classic-mini");
  const selectedMap = findSupportedMap(mapId);
  if (!selectedMap) {
    throw createLocalizedError("La mappa selezionata non e supportata.", "newGame.invalidMap");
  }

  const requestedDiceRuleSetId = String(input.diceRuleSetId || STANDARD_DICE_RULE_SET_ID);
  const selectedDiceRuleSet = findDiceRuleSet(requestedDiceRuleSetId);
  if (!selectedDiceRuleSet) {
    throw createLocalizedError("La regola dadi selezionata non e supportata.", "newGame.invalidDiceRuleSet");
  }

  const requestedVictoryRuleId = String(input.victoryRuleId || "standard-elimination");
  const selectedVictoryRule = findVictoryRule(requestedVictoryRuleId);
  if (!selectedVictoryRule) {
    throw createLocalizedError("La regola vittoria selezionata non e supportata.", "newGame.invalidVictoryRule");
  }

  const enabledRuleModuleIds = Array.isArray(input.enabledRuleModuleIds)
    ? [...new Set(input.enabledRuleModuleIds.map((entry) => String(entry || "").trim()).filter(Boolean))]
    : [];

  enabledRuleModuleIds.forEach((ruleModuleId) => {
    if (!findRuleModule(ruleModuleId)) {
      throw createLocalizedError("La regola opzionale selezionata non e supportata.", "newGame.invalidRuleModule", { ruleModuleId });
    }
  });

  const setupOptions = input.setupOptions && typeof input.setupOptions === "object" && !Array.isArray(input.setupOptions)
    ? { ...input.setupOptions }
    : {};

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

  const gameModeDefinition = createGameModeDefinition({
    id: input.gameModeId || null,
    name: input.gameModeName || "Modalita standard",
    mapId,
    diceRuleSetId: selectedDiceRuleSet.id,
    victoryRuleId: selectedVictoryRule.id,
    enabledRuleModuleIds,
    setupOptions
  });

  return {
    name: input.name,
    mapId,
    mapName: selectedMap.name,
    selectedMap,
    diceRuleSetId: selectedDiceRuleSet.id,
    victoryRuleId: selectedVictoryRule.id,
    enabledRuleModuleIds,
    setupOptions,
    gameModeDefinition,
    totalPlayers,
    players
  };
}

function createConfiguredInitialState(configInput = {}, options = {}) {
  const config = validateNewGameConfig(configInput, options);
  const state = createInitialState(config.selectedMap);
  state.diceRuleSetId = config.diceRuleSetId;
  state.communityId = configInput.communityId || null;
  state.gameModeId = config.gameModeDefinition.id;
  state.gameModeDefinition = config.gameModeDefinition;
  state.gameConfig = {
    mapId: config.mapId,
    mapName: config.mapName,
    diceRuleSetId: config.diceRuleSetId,
    victoryRuleId: config.victoryRuleId,
    enabledRuleModuleIds: config.enabledRuleModuleIds,
    setupOptions: config.setupOptions,
    gameModeDefinition: config.gameModeDefinition,
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

module.exports = {
  AI_GENERAL_NAMES,
  listDiceRuleSets,
  listRuleModules,
  listSupportedMaps,
  listVictoryRules,
  buildHistoricalAiNames,
  createConfiguredInitialState,
  findSupportedMap,
  validateNewGameConfig
};
