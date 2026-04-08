const { STANDARD_DICE_RULE_SET_ID } = require("./dice.cjs");

const DEFAULT_VICTORY_RULE_ID = "standard-elimination";

function normalizeEnabledRuleModuleIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean))];
}

function normalizeSetupOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function createGameModeDefinition(input = {}) {
  return {
    id: input.id || null,
    name: input.name || "Modalita standard",
    mapId: input.mapId || "classic-mini",
    diceRuleSetId: input.diceRuleSetId || STANDARD_DICE_RULE_SET_ID,
    victoryRuleId: input.victoryRuleId || DEFAULT_VICTORY_RULE_ID,
    enabledRuleModuleIds: normalizeEnabledRuleModuleIds(input.enabledRuleModuleIds),
    setupOptions: normalizeSetupOptions(input.setupOptions)
  };
}

function createDefaultGameModeDefinition(overrides = {}) {
  return createGameModeDefinition({
    id: "default",
    name: "Standard",
    ...overrides
  });
}

module.exports = {
  DEFAULT_VICTORY_RULE_ID,
  createDefaultGameModeDefinition,
  createGameModeDefinition
};
