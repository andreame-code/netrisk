const { listRuleModifierManifests } = require("../../shared/engine-definitions.cjs");

function listRuleModifierDefinitions() {
  return listRuleModifierManifests();
}

function findRuleModifierDefinition(modifierId) {
  return listRuleModifierDefinitions().find((modifier) => modifier.id === modifierId) || null;
}

function validateModifierAvailability(state, modifierId) {
  const enabledIds = Array.isArray(state?.resolvedGameConfig?.ruleModifiers)
    ? state.resolvedGameConfig.ruleModifiers.map((modifier) => modifier.id)
    : (Array.isArray(state?.gameConfig?.ruleModifierIds) ? state.gameConfig.ruleModifierIds : []);

  return enabledIds.includes(modifierId);
}

module.exports = {
  findRuleModifierDefinition,
  listRuleModifierDefinitions,
  validateModifierAvailability
};
