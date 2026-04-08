const { getDiceRuleSet } = require("../../shared/dice.cjs");
const {
  DEFAULT_RULE_MODIFIER_ID,
  getPieceThemeDefinition,
  getVictoryRuleDefinition
} = require("../../shared/engine-definitions.cjs");

function getResolvedGameConfig(state) {
  return state && state.resolvedGameConfig && typeof state.resolvedGameConfig === "object"
    ? state.resolvedGameConfig
    : null;
}

function getStateCombatRule(state) {
  const resolved = getResolvedGameConfig(state);
  if (resolved && resolved.combatRule) {
    return resolved.combatRule;
  }

  return getDiceRuleSet(state?.diceRuleSetId || "standard");
}

function getStatePieceTheme(state) {
  const resolved = getResolvedGameConfig(state);
  if (resolved && resolved.pieceTheme) {
    return resolved.pieceTheme;
  }

  return getPieceThemeDefinition(state?.pieceThemeId || null);
}

function getPlayerPalette(state) {
  const pieceTheme = getStatePieceTheme(state);
  return Array.isArray(pieceTheme?.palette) && pieceTheme.palette.length
    ? pieceTheme.palette
    : ["#e85d04", "#0f4c5c", "#6a994e", "#8338ec"];
}

function getStateVictoryRule(state) {
  const resolved = getResolvedGameConfig(state);
  if (resolved && resolved.victoryRule) {
    return resolved.victoryRule;
  }

  return getVictoryRuleDefinition(state?.gameConfig?.victoryRuleId || null);
}

function getEnabledRuleModifierIds(state) {
  const resolved = getResolvedGameConfig(state);
  if (resolved && Array.isArray(resolved.ruleModifiers) && resolved.ruleModifiers.length) {
    return resolved.ruleModifiers.map((modifier) => modifier.id);
  }

  if (Array.isArray(state?.gameConfig?.ruleModifierIds) && state.gameConfig.ruleModifierIds.length) {
    return state.gameConfig.ruleModifierIds.map((modifierId) => String(modifierId));
  }

  return [DEFAULT_RULE_MODIFIER_ID];
}

function hasRuleModifier(state, modifierId) {
  return getEnabledRuleModifierIds(state).includes(modifierId);
}

module.exports = {
  getEnabledRuleModifierIds,
  getPlayerPalette,
  getResolvedGameConfig,
  getStateCombatRule,
  getStatePieceTheme,
  getStateVictoryRule,
  hasRuleModifier
};
