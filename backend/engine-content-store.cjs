const crypto = require("crypto");
const path = require("path");
const { createDatastore } = require("./datastore.cjs");
const {
  DEFAULT_PIECE_THEME_ID,
  DEFAULT_RULE_MODIFIER_ID,
  createGameRulesetDefinition,
  createPieceThemeDefinition,
  createResolvedGameConfig,
  createVictoryRuleDefinition,
  getCombatRuleDefinition,
  listCombatRuleDefinitions,
  listGameRulesetDefinitions,
  listMapDefinitions,
  listPieceThemeDefinitions,
  listRuleModifierManifests,
  listVictoryModuleManifests,
  listVictoryRuleDefinitions,
  normalizeMapDefinition,
  summarizeMapDefinition
} = require("../shared/engine-definitions.cjs");
const { STANDARD_DICE_RULE_SET_ID, findCombatRuleDefinition } = require("../shared/combat-rules.cjs");
const { createLocalizedError } = require("../shared/messages.cjs");

const ENGINE_CONTENT_STATE_KEY = "engineContent.v1";

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

function sortByName(items) {
  return items.slice().sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
}

function mergeSeedAndCustom(seedItems, customItems) {
  const byId = new Map();

  seedItems.forEach((item) => {
    byId.set(item.id, safeClone(item));
  });

  customItems.forEach((item) => {
    byId.set(item.id, safeClone(item));
  });

  return sortByName(Array.from(byId.values()));
}

function createEngineContentStore(options = {}) {
  const datastore = options.datastore || createDatastore({
    dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
    legacyGamesFile: options.dataFile || path.join(__dirname, "..", "data", "games.json"),
    legacyUsersFile: options.usersFile || options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    legacySessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
  });

  async function readCustomState() {
    const state = await datastore.getAppStateValue(ENGINE_CONTENT_STATE_KEY, null);
    if (!state || typeof state !== "object") {
      return {
        maps: [],
        pieceThemes: [],
        victoryRules: [],
        gameRulesets: []
      };
    }

    return {
      maps: Array.isArray(state.maps) ? state.maps : [],
      pieceThemes: Array.isArray(state.pieceThemes) ? state.pieceThemes : [],
      victoryRules: Array.isArray(state.victoryRules) ? state.victoryRules : [],
      gameRulesets: Array.isArray(state.gameRulesets) ? state.gameRulesets : []
    };
  }

  async function writeCustomState(state) {
    await datastore.setAppStateValue(ENGINE_CONTENT_STATE_KEY, state);
  }

  function validateRuleModifierIds(ruleModifierIds = []) {
    const availableIds = new Set(listRuleModifierManifests().map((modifier) => modifier.id));
    ruleModifierIds.forEach((modifierId) => {
      if (!availableIds.has(modifierId)) {
        throw createLocalizedError("Il ruleset contiene un modifier non supportato.", "engine.ruleset.invalidModifier", { modifierId });
      }
    });
  }

  function assertSeedIdIsReadonly(seedItems, entityId, message, messageKey, params) {
    if (seedItems.some((item) => item.id === entityId)) {
      throw createLocalizedError(message, messageKey, params);
    }
  }

  async function listMaps() {
    const state = await readCustomState();
    return mergeSeedAndCustom(listMapDefinitions(), state.maps);
  }

  async function listMapSummaries() {
    return (await listMaps()).map((map) => summarizeMapDefinition(map));
  }

  async function findMap(mapId) {
    return (await listMaps()).find((map) => map.id === mapId) || null;
  }

  async function listPieceThemes() {
    const state = await readCustomState();
    return mergeSeedAndCustom(listPieceThemeDefinitions(), state.pieceThemes);
  }

  async function findPieceTheme(pieceThemeId) {
    return (await listPieceThemes()).find((theme) => theme.id === pieceThemeId) || null;
  }

  async function listVictoryRules() {
    const state = await readCustomState();
    return mergeSeedAndCustom(listVictoryRuleDefinitions(), state.victoryRules);
  }

  async function findVictoryRule(victoryRuleId) {
    return (await listVictoryRules()).find((rule) => rule.id === victoryRuleId) || null;
  }

  async function listGameRulesets() {
    const state = await readCustomState();
    return mergeSeedAndCustom(listGameRulesetDefinitions(), state.gameRulesets);
  }

  async function findGameRuleset(gameRulesetId) {
    return (await listGameRulesets()).find((ruleset) => ruleset.id === gameRulesetId) || null;
  }

  async function createOrUpdateMap(input, existingId = null) {
    const state = await readCustomState();
    const normalized = normalizeMapDefinition({
      ...input,
      id: existingId || input.id || randomId("map"),
      source: "custom",
      editable: true
    });

    assertSeedIdIsReadonly(
      listMapDefinitions(),
      normalized.id,
      "Non puoi sovrascrivere una mappa seed.",
      "engine.map.seedReadonly",
      { mapId: normalized.id }
    );

    const nextMaps = state.maps.filter((map) => map.id !== normalized.id);
    nextMaps.push(normalized);
    await writeCustomState({
      ...state,
      maps: nextMaps
    });
    return normalized;
  }

  async function deleteMap(mapId) {
    const state = await readCustomState();
    const exists = state.maps.some((map) => map.id === mapId);
    if (!exists) {
      throw createLocalizedError("La mappa custom non esiste.", "engine.map.notFound", { mapId });
    }

    if (state.gameRulesets.some((ruleset) => ruleset.mapId === mapId)) {
      throw createLocalizedError("La mappa e ancora usata da un ruleset custom.", "engine.map.inUse", { mapId });
    }

    await writeCustomState({
      ...state,
      maps: state.maps.filter((map) => map.id !== mapId)
    });
  }

  async function createOrUpdatePieceTheme(input, existingId = null) {
    const state = await readCustomState();
    const normalized = createPieceThemeDefinition({
      ...input,
      id: existingId || input.id || randomId("piece-theme"),
      source: "custom",
      editable: true
    });

    assertSeedIdIsReadonly(
      listPieceThemeDefinitions(),
      normalized.id,
      "Non puoi sovrascrivere una pedina seed.",
      "engine.pieceTheme.seedReadonly",
      { pieceThemeId: normalized.id }
    );

    const nextPieceThemes = state.pieceThemes.filter((theme) => theme.id !== normalized.id);
    nextPieceThemes.push(normalized);
    await writeCustomState({
      ...state,
      pieceThemes: nextPieceThemes
    });
    return normalized;
  }

  async function deletePieceTheme(pieceThemeId) {
    const state = await readCustomState();
    const exists = state.pieceThemes.some((theme) => theme.id === pieceThemeId);
    if (!exists) {
      throw createLocalizedError("La pedina custom non esiste.", "engine.pieceTheme.notFound", { pieceThemeId });
    }

    if (state.gameRulesets.some((ruleset) => ruleset.pieceThemeId === pieceThemeId)) {
      throw createLocalizedError("La pedina e ancora usata da un ruleset custom.", "engine.pieceTheme.inUse", { pieceThemeId });
    }

    await writeCustomState({
      ...state,
      pieceThemes: state.pieceThemes.filter((theme) => theme.id !== pieceThemeId)
    });
  }

  async function createOrUpdateVictoryRule(input, existingId = null) {
    const availableModuleIds = new Set(listVictoryModuleManifests().map((manifest) => manifest.id));
    const state = await readCustomState();
    const normalized = createVictoryRuleDefinition({
      ...input,
      id: existingId || input.id || randomId("victory-rule"),
      source: "custom",
      editable: true
    });

    if (!availableModuleIds.has(normalized.moduleId)) {
      throw createLocalizedError("Il modulo vittoria selezionato non e supportato.", "engine.victoryRule.invalidModule", { moduleId: normalized.moduleId });
    }

    assertSeedIdIsReadonly(
      listVictoryRuleDefinitions(),
      normalized.id,
      "Non puoi sovrascrivere una regola seed.",
      "engine.victoryRule.seedReadonly",
      { victoryRuleId: normalized.id }
    );

    const nextVictoryRules = state.victoryRules.filter((rule) => rule.id !== normalized.id);
    nextVictoryRules.push(normalized);
    await writeCustomState({
      ...state,
      victoryRules: nextVictoryRules
    });
    return normalized;
  }

  async function deleteVictoryRule(victoryRuleId) {
    const state = await readCustomState();
    const exists = state.victoryRules.some((rule) => rule.id === victoryRuleId);
    if (!exists) {
      throw createLocalizedError("La regola vittoria custom non esiste.", "engine.victoryRule.notFound", { victoryRuleId });
    }

    if (state.gameRulesets.some((ruleset) => ruleset.victoryRuleId === victoryRuleId)) {
      throw createLocalizedError("La regola vittoria e ancora usata da un ruleset custom.", "engine.victoryRule.inUse", { victoryRuleId });
    }

    await writeCustomState({
      ...state,
      victoryRules: state.victoryRules.filter((rule) => rule.id !== victoryRuleId)
    });
  }

  async function createOrUpdateGameRuleset(input, existingId = null) {
    const state = await readCustomState();
    const normalized = createGameRulesetDefinition({
      ...input,
      id: existingId || input.id || randomId("ruleset"),
      source: "custom",
      editable: true,
      ruleModifierIds: Array.isArray(input.ruleModifierIds)
        ? input.ruleModifierIds
        : [DEFAULT_RULE_MODIFIER_ID]
    });

    const selectedMap = await findMap(normalized.mapId);
    if (!selectedMap) {
      throw createLocalizedError("Il ruleset punta a una mappa inesistente.", "engine.ruleset.unknownMap", { mapId: normalized.mapId });
    }

    const selectedPieceTheme = await findPieceTheme(normalized.pieceThemeId);
    if (!selectedPieceTheme) {
      throw createLocalizedError("Il ruleset punta a una pedina inesistente.", "engine.ruleset.unknownPieceTheme", { pieceThemeId: normalized.pieceThemeId });
    }

    const selectedVictoryRule = await findVictoryRule(normalized.victoryRuleId);
    if (!selectedVictoryRule) {
      throw createLocalizedError("Il ruleset punta a una regola vittoria inesistente.", "engine.ruleset.unknownVictoryRule", { victoryRuleId: normalized.victoryRuleId });
    }

    if (!findCombatRuleDefinition(normalized.combatRuleId)) {
      throw createLocalizedError("Il ruleset punta a una regola combattimento inesistente.", "engine.ruleset.unknownCombatRule", { combatRuleId: normalized.combatRuleId });
    }

    validateRuleModifierIds(normalized.ruleModifierIds);

    assertSeedIdIsReadonly(
      listGameRulesetDefinitions(),
      normalized.id,
      "Non puoi sovrascrivere un ruleset seed.",
      "engine.ruleset.seedReadonly",
      { rulesetId: normalized.id }
    );

    const nextRulesets = state.gameRulesets.filter((ruleset) => ruleset.id !== normalized.id);
    nextRulesets.push(normalized);
    await writeCustomState({
      ...state,
      gameRulesets: nextRulesets
    });
    return normalized;
  }

  async function deleteGameRuleset(gameRulesetId) {
    const state = await readCustomState();
    const exists = state.gameRulesets.some((ruleset) => ruleset.id === gameRulesetId);
    if (!exists) {
      throw createLocalizedError("Il ruleset custom non esiste.", "engine.ruleset.notFound", { rulesetId: gameRulesetId });
    }

    await writeCustomState({
      ...state,
      gameRulesets: state.gameRulesets.filter((ruleset) => ruleset.id !== gameRulesetId)
    });
  }

  async function listCatalog() {
    const [maps, pieceThemes, victoryRules, gameRulesets] = await Promise.all([
      listMapSummaries(),
      listPieceThemes(),
      listVictoryRules(),
      listGameRulesets()
    ]);

    return {
      maps,
      pieceThemes,
      victoryRules,
      combatRules: listCombatRuleDefinitions(),
      gameRulesets,
      ruleModifiers: listRuleModifierManifests(),
      modules: {
        victory: listVictoryModuleManifests(),
        ruleModifiers: listRuleModifierManifests()
      }
    };
  }

  async function resolveRulesetBundle(input = {}) {
    const rulesetId = input.rulesetId || input.gameRulesetId || null;

    let selectedGameRuleset = null;
    if (rulesetId) {
      selectedGameRuleset = await findGameRuleset(String(rulesetId));
      if (!selectedGameRuleset) {
        throw createLocalizedError("Il ruleset selezionato non e supportato.", "newGame.invalidRuleset");
      }
    }

    const mapId = String(input.mapId || selectedGameRuleset?.mapId || "classic-mini");
    const pieceThemeId = String(input.pieceThemeId || selectedGameRuleset?.pieceThemeId || DEFAULT_PIECE_THEME_ID);
    const victoryRuleId = String(input.victoryRuleId || selectedGameRuleset?.victoryRuleId || "domination");
    const combatRuleId = String(input.combatRuleId || input.diceRuleSetId || selectedGameRuleset?.combatRuleId || STANDARD_DICE_RULE_SET_ID);
    const ruleModifierIds = Array.isArray(input.ruleModifierIds)
      ? input.ruleModifierIds.map((modifierId) => String(modifierId))
      : (selectedGameRuleset?.ruleModifierIds || [DEFAULT_RULE_MODIFIER_ID]);

    const [selectedMap, selectedPieceTheme, selectedVictoryRule] = await Promise.all([
      findMap(mapId),
      findPieceTheme(pieceThemeId),
      findVictoryRule(victoryRuleId)
    ]);

    if (!selectedMap) {
      throw createLocalizedError("La mappa selezionata non e supportata.", "newGame.invalidMap");
    }

    if (!selectedPieceTheme) {
      throw createLocalizedError("La pedina selezionata non e supportata.", "newGame.invalidPieceTheme");
    }

    if (!selectedVictoryRule) {
      throw createLocalizedError("La regola vittoria selezionata non e supportata.", "newGame.invalidVictoryRule");
    }

    const selectedCombatRule = findCombatRuleDefinition(combatRuleId);
    if (!selectedCombatRule) {
      throw createLocalizedError("La regola dadi selezionata non e supportata.", "newGame.invalidDiceRuleSet");
    }

    validateRuleModifierIds(ruleModifierIds);

    const selectedRuleModifiers = listRuleModifierManifests().filter((modifier) => ruleModifierIds.includes(modifier.id));
    const fallbackRuleset = selectedGameRuleset || {
      id: null,
      name: input.name || "Custom Ruleset",
      description: "",
      mapId,
      pieceThemeId,
      victoryRuleId,
      combatRuleId,
      ruleModifierIds
    };

    return {
      selectedGameRuleset: safeClone(fallbackRuleset),
      selectedMap: safeClone(selectedMap),
      selectedPieceTheme: safeClone(selectedPieceTheme),
      selectedVictoryRule: safeClone(selectedVictoryRule),
      selectedCombatRule: safeClone(selectedCombatRule),
      selectedRuleModifiers: selectedRuleModifiers.map((modifier) => safeClone(modifier)),
      resolvedGameConfig: createResolvedGameConfig({
        gameRuleset: fallbackRuleset,
        map: selectedMap,
        pieceTheme: selectedPieceTheme,
        victoryRule: selectedVictoryRule,
        combatRule: selectedCombatRule,
        ruleModifiers: selectedRuleModifiers
      })
    };
  }

  return {
    createOrUpdateGameRuleset,
    createOrUpdateMap,
    createOrUpdatePieceTheme,
    createOrUpdateVictoryRule,
    datastore,
    deleteGameRuleset,
    deleteMap,
    deletePieceTheme,
    deleteVictoryRule,
    findGameRuleset,
    findMap,
    findPieceTheme,
    findVictoryRule,
    listCatalog,
    listCombatRules: listCombatRuleDefinitions,
    listGameRulesets,
    listMapSummaries,
    listMaps,
    listModules() {
      return {
        victory: listVictoryModuleManifests(),
        ruleModifiers: listRuleModifierManifests()
      };
    },
    listPieceThemes,
    listRuleModifiers: listRuleModifierManifests,
    listVictoryRules,
    resolveRulesetBundle
  };
}

module.exports = {
  ENGINE_CONTENT_STATE_KEY,
  createEngineContentStore
};
