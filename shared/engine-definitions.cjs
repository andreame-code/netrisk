const { registeredMaps } = require("./maps/index.cjs");
const {
  STANDARD_DICE_RULE_SET_ID,
  THREE_DEFENSE_DICE_RULE_SET_ID,
  getCombatRuleDefinition,
  listCombatRuleDefinitions
} = require("./combat-rules.cjs");
const { createLocalizedError } = require("./messages.cjs");

const DEFAULT_PIECE_THEME_ID = "classic-commanders";
const DEFAULT_VICTORY_RULE_ID = "domination";
const DEFAULT_GAME_RULESET_ID = "classic-standard";
const DEFAULT_RULE_MODIFIER_ID = "banzai-attack";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureNonEmptyString(value, message, messageKey) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw createLocalizedError(message, messageKey);
  }

  return normalized;
}

function normalizeAspectRatio(input) {
  if (!input) {
    return null;
  }

  const width = Number(input.width);
  const height = Number(input.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw createLocalizedError("Aspect ratio non valido.", "engine.map.invalidAspectRatio");
  }

  return { width, height };
}

function normalizeTerritoryDefinition(territory, index) {
  if (!territory || typeof territory !== "object") {
    throw createLocalizedError("Territorio non valido.", "engine.map.invalidTerritory", { index });
  }

  return {
    id: ensureNonEmptyString(territory.id, "Ogni territorio deve avere un id.", "engine.map.territoryIdRequired"),
    name: ensureNonEmptyString(territory.name, "Ogni territorio deve avere un nome.", "engine.map.territoryNameRequired"),
    continentId: territory.continentId == null ? null : String(territory.continentId),
    neighbors: Array.isArray(territory.neighbors)
      ? territory.neighbors.map((neighborId) => ensureNonEmptyString(neighborId, "Neighbor non valido.", "engine.map.invalidNeighbor"))
      : []
  };
}

function normalizeContinentDefinition(continent, index) {
  if (!continent || typeof continent !== "object") {
    throw createLocalizedError("Continente non valido.", "engine.map.invalidContinent", { index });
  }

  return {
    id: ensureNonEmptyString(continent.id, "Ogni continente deve avere un id.", "engine.map.continentIdRequired"),
    name: ensureNonEmptyString(continent.name, "Ogni continente deve avere un nome.", "engine.map.continentNameRequired"),
    bonus: Number.isFinite(Number(continent.bonus)) ? Number(continent.bonus) : 0,
    territoryIds: Array.isArray(continent.territoryIds)
      ? continent.territoryIds.map((territoryId) => ensureNonEmptyString(territoryId, "Territory id continente non valido.", "engine.map.invalidContinentTerritory"))
      : []
  };
}

function normalizeMapPositions(positions = {}, territoryIds = new Set()) {
  if (!positions || typeof positions !== "object" || Array.isArray(positions)) {
    return {};
  }

  return Object.entries(positions).reduce((result, [territoryId, point]) => {
    if (!territoryIds.has(territoryId) || !point || typeof point !== "object") {
      return result;
    }

    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw createLocalizedError("Coordinate territorio non valide.", "engine.map.invalidPosition", { territoryId });
    }

    result[territoryId] = { x, y };
    return result;
  }, {});
}

function normalizeMapDefinition(input = {}, options = {}) {
  const requireId = options.requireId !== false;
  const territories = Array.isArray(input.territories) ? input.territories.map(normalizeTerritoryDefinition) : [];
  if (!territories.length) {
    throw createLocalizedError("La mappa deve avere almeno un territorio.", "engine.map.territoriesRequired");
  }

  const territoryIds = new Set();
  territories.forEach((territory) => {
    if (territoryIds.has(territory.id)) {
      throw createLocalizedError("La mappa contiene territori duplicati.", "engine.map.duplicateTerritoryId", { territoryId: territory.id });
    }
    territoryIds.add(territory.id);
  });

  territories.forEach((territory) => {
    territory.neighbors.forEach((neighborId) => {
      if (!territoryIds.has(neighborId)) {
        throw createLocalizedError("La mappa contiene adiacenze verso territori inesistenti.", "engine.map.unknownNeighbor", {
          territoryId: territory.id,
          neighborId
        });
      }
    });
  });

  const continents = Array.isArray(input.continents) ? input.continents.map(normalizeContinentDefinition) : [];
  const continentIds = new Set();
  continents.forEach((continent) => {
    if (continentIds.has(continent.id)) {
      throw createLocalizedError("La mappa contiene continenti duplicati.", "engine.map.duplicateContinentId", { continentId: continent.id });
    }
    continentIds.add(continent.id);
    continent.territoryIds.forEach((territoryId) => {
      if (!territoryIds.has(territoryId)) {
        throw createLocalizedError("Il continente contiene un territorio inesistente.", "engine.map.unknownContinentTerritory", {
          continentId: continent.id,
          territoryId
        });
      }
    });
  });

  territories.forEach((territory) => {
    if (territory.continentId && !continentIds.has(territory.continentId)) {
      throw createLocalizedError("Il territorio punta a un continente inesistente.", "engine.map.unknownTerritoryContinent", {
        territoryId: territory.id,
        continentId: territory.continentId
      });
    }
  });

  return {
    id: requireId ? ensureNonEmptyString(input.id, "La mappa deve avere un id.", "engine.map.idRequired") : (input.id ? String(input.id) : null),
    name: ensureNonEmptyString(input.name, "La mappa deve avere un nome.", "engine.map.nameRequired"),
    territories: deepClone(territories),
    positions: normalizeMapPositions(input.positions, territoryIds),
    continents: deepClone(continents),
    backgroundImage: input.backgroundImage ? String(input.backgroundImage) : null,
    aspectRatio: normalizeAspectRatio(input.aspectRatio),
    editable: input.editable !== false,
    source: input.source || "custom"
  };
}

function summarizeMapDefinition(map) {
  const normalizedMap = normalizeMapDefinition(map);
  return {
    id: normalizedMap.id,
    name: normalizedMap.name,
    territoryCount: normalizedMap.territories.length,
    continentCount: normalizedMap.continents.length,
    continentBonuses: normalizedMap.continents.map((continent) => ({
      id: continent.id,
      name: continent.name,
      bonus: continent.bonus,
      territoryCount: continent.territoryIds.length
    })),
    editable: normalizedMap.editable !== false,
    source: normalizedMap.source || "custom"
  };
}

function createMapDefinitionFromRegisteredMap(map) {
  return normalizeMapDefinition({
    id: map.id,
    name: map.name,
    territories: map.territories,
    positions: map.positions,
    continents: map.continents,
    backgroundImage: map.backgroundImage || null,
    aspectRatio: map.aspectRatio || null,
    editable: false,
    source: "seed"
  });
}

const seedMapDefinitions = Object.freeze(registeredMaps.map(createMapDefinitionFromRegisteredMap));

function createPieceThemeDefinition(input = {}, options = {}) {
  const requireId = options.requireId !== false;
  const palette = Array.isArray(input.palette) ? input.palette.map((color) => String(color)) : [];
  if (!palette.length) {
    throw createLocalizedError("La pedina deve avere almeno un colore.", "engine.pieceTheme.paletteRequired");
  }

  return {
    id: requireId ? ensureNonEmptyString(input.id, "La pedina deve avere un id.", "engine.pieceTheme.idRequired") : (input.id ? String(input.id) : null),
    name: ensureNonEmptyString(input.name, "La pedina deve avere un nome.", "engine.pieceTheme.nameRequired"),
    palette,
    icon: input.icon ? String(input.icon) : null,
    tokenShape: input.tokenShape ? String(input.tokenShape) : "badge",
    armyLabel: input.armyLabel ? String(input.armyLabel) : "Armies",
    source: input.source || "custom",
    editable: input.editable !== false
  };
}

const seedPieceThemes = Object.freeze([
  createPieceThemeDefinition({
    id: DEFAULT_PIECE_THEME_ID,
    name: "Classic Commanders",
    palette: ["#e85d04", "#0f4c5c", "#6a994e", "#8338ec"],
    icon: "shield",
    tokenShape: "badge",
    armyLabel: "Armies",
    source: "seed",
    editable: false
  }),
  createPieceThemeDefinition({
    id: "ashen-alliances",
    name: "Ashen Alliances",
    palette: ["#d8572a", "#1f7a8c", "#5c8001", "#4f345a"],
    icon: "banner",
    tokenShape: "banner",
    armyLabel: "Legions",
    source: "seed",
    editable: false
  })
]);

function createVictoryRuleDefinition(input = {}, options = {}) {
  const requireId = options.requireId !== false;
  return {
    id: requireId ? ensureNonEmptyString(input.id, "La regola vittoria deve avere un id.", "engine.victoryRule.idRequired") : (input.id ? String(input.id) : null),
    name: ensureNonEmptyString(input.name, "La regola vittoria deve avere un nome.", "engine.victoryRule.nameRequired"),
    moduleId: ensureNonEmptyString(input.moduleId, "La regola vittoria deve avere un modulo.", "engine.victoryRule.moduleRequired"),
    description: input.description ? String(input.description) : "",
    config: input.config && typeof input.config === "object" && !Array.isArray(input.config) ? deepClone(input.config) : {},
    editable: input.editable !== false,
    source: input.source || "custom"
  };
}

const seedVictoryRules = Object.freeze([
  createVictoryRuleDefinition({
    id: DEFAULT_VICTORY_RULE_ID,
    name: "Dominazione Totale",
    moduleId: "domination",
    description: "Vinci quando resti l'unico giocatore attivo.",
    config: {},
    source: "seed",
    editable: false
  }),
  createVictoryRuleDefinition({
    id: "capture-18-territories",
    name: "Controlla 18 territori",
    moduleId: "capture-territories",
    description: "Vinci quando controlli almeno 18 territori.",
    config: {
      targetTerritoryCount: 18
    },
    source: "seed",
    editable: false
  })
]);

function createGameRulesetDefinition(input = {}, options = {}) {
  const requireId = options.requireId !== false;
  return {
    id: requireId ? ensureNonEmptyString(input.id, "Il ruleset deve avere un id.", "engine.ruleset.idRequired") : (input.id ? String(input.id) : null),
    name: ensureNonEmptyString(input.name, "Il ruleset deve avere un nome.", "engine.ruleset.nameRequired"),
    description: input.description ? String(input.description) : "",
    mapId: ensureNonEmptyString(input.mapId, "Il ruleset deve avere una mappa.", "engine.ruleset.mapRequired"),
    pieceThemeId: ensureNonEmptyString(input.pieceThemeId, "Il ruleset deve avere una pedina.", "engine.ruleset.pieceThemeRequired"),
    victoryRuleId: ensureNonEmptyString(input.victoryRuleId, "Il ruleset deve avere una regola vittoria.", "engine.ruleset.victoryRuleRequired"),
    combatRuleId: ensureNonEmptyString(input.combatRuleId, "Il ruleset deve avere una regola combattimento.", "engine.ruleset.combatRuleRequired"),
    ruleModifierIds: Array.isArray(input.ruleModifierIds) ? input.ruleModifierIds.map((modifierId) => String(modifierId)) : [],
    editable: input.editable !== false,
    source: input.source || "custom"
  };
}

const seedGameRulesets = Object.freeze([
  createGameRulesetDefinition({
    id: DEFAULT_GAME_RULESET_ID,
    name: "Classic Standard",
    description: "Classic Mini con vittoria per dominio e difesa a 2 dadi.",
    mapId: "classic-mini",
    pieceThemeId: DEFAULT_PIECE_THEME_ID,
    victoryRuleId: DEFAULT_VICTORY_RULE_ID,
    combatRuleId: STANDARD_DICE_RULE_SET_ID,
    ruleModifierIds: [DEFAULT_RULE_MODIFIER_ID],
    source: "seed",
    editable: false
  }),
  createGameRulesetDefinition({
    id: "classic-three-defense",
    name: "Classic 3-Defense",
    description: "Classic Mini con vittoria per dominio e difesa a 3 dadi.",
    mapId: "classic-mini",
    pieceThemeId: DEFAULT_PIECE_THEME_ID,
    victoryRuleId: DEFAULT_VICTORY_RULE_ID,
    combatRuleId: THREE_DEFENSE_DICE_RULE_SET_ID,
    ruleModifierIds: [DEFAULT_RULE_MODIFIER_ID],
    source: "seed",
    editable: false
  }),
  createGameRulesetDefinition({
    id: "classic-territory-rush",
    name: "Classic Territory Rush",
    description: "Classic Mini con obiettivo di controllo territorio.",
    mapId: "classic-mini",
    pieceThemeId: DEFAULT_PIECE_THEME_ID,
    victoryRuleId: "capture-18-territories",
    combatRuleId: STANDARD_DICE_RULE_SET_ID,
    ruleModifierIds: [DEFAULT_RULE_MODIFIER_ID],
    source: "seed",
    editable: false
  })
]);

const victoryModuleManifests = Object.freeze([
  {
    id: "domination",
    kind: "victory",
    name: "Dominazione totale",
    description: "Il giocatore vince quando resta l'unico attivo.",
    configFields: []
  },
  {
    id: "capture-territories",
    kind: "victory",
    name: "Controllo territori",
    description: "Il giocatore vince al raggiungimento della soglia di territori.",
    configFields: [
      {
        key: "targetTerritoryCount",
        label: "Territori obiettivo",
        type: "number",
        min: 1,
        defaultValue: 18
      }
    ]
  }
]);

const ruleModifierManifests = Object.freeze([
  {
    id: DEFAULT_RULE_MODIFIER_ID,
    kind: "ruleModifier",
    name: "Banzai Attack",
    description: "Abilita l'attacco banzai lato server.",
    hooks: ["validate"],
    configFields: []
  }
]);

function findById(items, id) {
  return items.find((item) => item.id === id) || null;
}

function listMapDefinitions() {
  return seedMapDefinitions.map((map) => deepClone(map));
}

function findMapDefinition(mapId) {
  return findById(seedMapDefinitions, mapId);
}

function getMapDefinition(mapId) {
  return deepClone(findMapDefinition(mapId) || seedMapDefinitions[0] || null);
}

function listPieceThemeDefinitions() {
  return seedPieceThemes.map((theme) => deepClone(theme));
}

function findPieceThemeDefinition(themeId) {
  return findById(seedPieceThemes, themeId);
}

function getPieceThemeDefinition(themeId) {
  return deepClone(findPieceThemeDefinition(themeId) || seedPieceThemes[0] || null);
}

function listVictoryRuleDefinitions() {
  return seedVictoryRules.map((rule) => deepClone(rule));
}

function findVictoryRuleDefinition(ruleId) {
  return findById(seedVictoryRules, ruleId);
}

function getVictoryRuleDefinition(ruleId) {
  return deepClone(findVictoryRuleDefinition(ruleId) || seedVictoryRules[0] || null);
}

function listGameRulesetDefinitions() {
  return seedGameRulesets.map((ruleset) => deepClone(ruleset));
}

function findGameRulesetDefinition(rulesetId) {
  return findById(seedGameRulesets, rulesetId);
}

function getGameRulesetDefinition(rulesetId) {
  return deepClone(findGameRulesetDefinition(rulesetId) || seedGameRulesets[0] || null);
}

function listVictoryModuleManifests() {
  return victoryModuleManifests.map((manifest) => deepClone(manifest));
}

function listRuleModifierManifests() {
  return ruleModifierManifests.map((manifest) => deepClone(manifest));
}

function createResolvedGameConfig(input = {}) {
  return {
    gameRuleset: input.gameRuleset ? deepClone(input.gameRuleset) : null,
    map: input.map ? deepClone(input.map) : null,
    pieceTheme: input.pieceTheme ? deepClone(input.pieceTheme) : null,
    victoryRule: input.victoryRule ? deepClone(input.victoryRule) : null,
    combatRule: input.combatRule ? deepClone(input.combatRule) : getCombatRuleDefinition(STANDARD_DICE_RULE_SET_ID),
    ruleModifiers: Array.isArray(input.ruleModifiers) ? input.ruleModifiers.map((modifier) => deepClone(modifier)) : []
  };
}

module.exports = {
  DEFAULT_GAME_RULESET_ID,
  DEFAULT_PIECE_THEME_ID,
  DEFAULT_RULE_MODIFIER_ID,
  DEFAULT_VICTORY_RULE_ID,
  createGameRulesetDefinition,
  createMapDefinitionFromRegisteredMap,
  createPieceThemeDefinition,
  createResolvedGameConfig,
  createVictoryRuleDefinition,
  getCombatRuleDefinition,
  getGameRulesetDefinition,
  getMapDefinition,
  getPieceThemeDefinition,
  getVictoryRuleDefinition,
  listCombatRuleDefinitions,
  listGameRulesetDefinitions,
  listMapDefinitions,
  listPieceThemeDefinitions,
  listRuleModifierManifests,
  listVictoryModuleManifests,
  listVictoryRuleDefinitions,
  normalizeMapDefinition,
  summarizeMapDefinition,
  seedGameRulesets,
  seedMapDefinitions,
  seedPieceThemes,
  seedVictoryRules
};
