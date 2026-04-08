const STANDARD_DICE_RULE_SET_ID = "standard";
const THREE_DEFENSE_DICE_RULE_SET_ID = "standard-3-defense";
const TWO_DEFENSE_ALIAS_DICE_RULE_SET_ID = "standard-2-defense";

function createCombatRuleDefinition(input = {}) {
  return Object.freeze({
    id: input.id || null,
    name: input.name || "",
    description: input.description || "",
    attackerMaxDice: Number.isInteger(input.attackerMaxDice) ? input.attackerMaxDice : 3,
    defenderMaxDice: Number.isInteger(input.defenderMaxDice) ? input.defenderMaxDice : 2,
    attackerMustLeaveOneArmyBehind: input.attackerMustLeaveOneArmyBehind !== false,
    defenderWinsTies: input.defenderWinsTies !== false
  });
}

const standardDiceRuleSet = createCombatRuleDefinition({
  id: STANDARD_DICE_RULE_SET_ID,
  name: "Standard",
  description: "Difesa fino a 2 dadi.",
  attackerMaxDice: 3,
  defenderMaxDice: 2,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const twoDefenseAliasDiceRuleSet = createCombatRuleDefinition({
  id: TWO_DEFENSE_ALIAS_DICE_RULE_SET_ID,
  name: "Standard 2-Dice Defense",
  description: "Compat alias per la difesa fino a 2 dadi.",
  attackerMaxDice: 3,
  defenderMaxDice: 2,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const threeDefenseDiceRuleSet = createCombatRuleDefinition({
  id: THREE_DEFENSE_DICE_RULE_SET_ID,
  name: "Standard 3-Dice Defense",
  description: "Difesa fino a 3 dadi.",
  attackerMaxDice: 3,
  defenderMaxDice: 3,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const combatRuleDefinitions = Object.freeze({
  [STANDARD_DICE_RULE_SET_ID]: standardDiceRuleSet,
  [THREE_DEFENSE_DICE_RULE_SET_ID]: threeDefenseDiceRuleSet,
  [TWO_DEFENSE_ALIAS_DICE_RULE_SET_ID]: twoDefenseAliasDiceRuleSet
});

function cloneRule(rule) {
  if (!rule) {
    return null;
  }

  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    attackerMaxDice: rule.attackerMaxDice,
    defenderMaxDice: rule.defenderMaxDice,
    attackerMustLeaveOneArmyBehind: rule.attackerMustLeaveOneArmyBehind,
    defenderWinsTies: rule.defenderWinsTies
  };
}

function findCombatRuleDefinition(ruleId) {
  if (!ruleId) {
    return null;
  }

  return combatRuleDefinitions[ruleId] || null;
}

function getCombatRuleDefinition(ruleId = STANDARD_DICE_RULE_SET_ID) {
  return findCombatRuleDefinition(ruleId) || standardDiceRuleSet;
}

function listCombatRuleDefinitions() {
  return Object.values(combatRuleDefinitions).reduce((rules, rule) => {
    if (!rule || rule.id === TWO_DEFENSE_ALIAS_DICE_RULE_SET_ID) {
      return rules;
    }
    rules.push(cloneRule(rule));
    return rules;
  }, []);
}

function findDiceRuleSet(ruleSetId) {
  return findCombatRuleDefinition(ruleSetId);
}

function getDiceRuleSet(ruleSetId = STANDARD_DICE_RULE_SET_ID) {
  return getCombatRuleDefinition(ruleSetId);
}

function listDiceRuleSets() {
  return listCombatRuleDefinitions().map((rule) => ({
    id: rule.id,
    name: rule.name,
    attackerMaxDice: rule.attackerMaxDice,
    defenderMaxDice: rule.defenderMaxDice
  }));
}

module.exports = {
  STANDARD_DICE_RULE_SET_ID,
  THREE_DEFENSE_DICE_RULE_SET_ID,
  TWO_DEFENSE_ALIAS_DICE_RULE_SET_ID,
  combatRuleDefinitions,
  createCombatRuleDefinition,
  findCombatRuleDefinition,
  findDiceRuleSet,
  getCombatRuleDefinition,
  getDiceRuleSet,
  listCombatRuleDefinitions,
  listDiceRuleSets,
  standardDiceRuleSet,
  twoDefenseAliasDiceRuleSet,
  threeDefenseDiceRuleSet
};
