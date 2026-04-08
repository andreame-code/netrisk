const STANDARD_DICE_RULE_SET_ID = "standard";
const STANDARD_TWO_DEFENSE_DICE_RULE_SET_ID = "standard-2-defense";
const STANDARD_THREE_DEFENSE_DICE_RULE_SET_ID = "standard-3-defense";

const standardTwoDefenseDiceRuleSet = Object.freeze({
  id: STANDARD_TWO_DEFENSE_DICE_RULE_SET_ID,
  name: "Standard",
  attackerMaxDice: 3,
  defenderMaxDice: 2,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const standardThreeDefenseDiceRuleSet = Object.freeze({
  id: STANDARD_THREE_DEFENSE_DICE_RULE_SET_ID,
  name: "Standard Difesa 3 Dadi",
  attackerMaxDice: 3,
  defenderMaxDice: 3,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const standardDiceRuleSet = Object.freeze({
  ...standardTwoDefenseDiceRuleSet,
  id: STANDARD_DICE_RULE_SET_ID
});

const diceRuleSets = Object.freeze({
  [STANDARD_DICE_RULE_SET_ID]: standardDiceRuleSet,
  [STANDARD_TWO_DEFENSE_DICE_RULE_SET_ID]: standardTwoDefenseDiceRuleSet,
  [STANDARD_THREE_DEFENSE_DICE_RULE_SET_ID]: standardThreeDefenseDiceRuleSet
});

function findDiceRuleSet(ruleSetId) {
  if (!ruleSetId) {
    return null;
  }

  return diceRuleSets[ruleSetId] || null;
}

function getDiceRuleSet(ruleSetId = STANDARD_DICE_RULE_SET_ID) {
  return findDiceRuleSet(ruleSetId) || standardDiceRuleSet;
}

function listDiceRuleSets() {
  return Object.values(diceRuleSets).map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    attackerMaxDice: ruleSet.attackerMaxDice,
    defenderMaxDice: ruleSet.defenderMaxDice
  }));
}

module.exports = {
  STANDARD_DICE_RULE_SET_ID,
  STANDARD_THREE_DEFENSE_DICE_RULE_SET_ID,
  STANDARD_TWO_DEFENSE_DICE_RULE_SET_ID,
  findDiceRuleSet,
  getDiceRuleSet,
  listDiceRuleSets,
  standardDiceRuleSet,
  standardThreeDefenseDiceRuleSet,
  standardTwoDefenseDiceRuleSet
};
