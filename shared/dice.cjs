const STANDARD_DICE_RULE_SET_ID = "standard";
const DEFENSE_THREE_DICE_RULE_SET_ID = "defense-3";

const standardDiceRuleSet = Object.freeze({
  id: STANDARD_DICE_RULE_SET_ID,
  name: "Standard",
  attackerMaxDice: 3,
  defenderMaxDice: 2,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const defenseThreeDiceRuleSet = Object.freeze({
  id: DEFENSE_THREE_DICE_RULE_SET_ID,
  name: "Defense 3 Dice",
  attackerMaxDice: 3,
  defenderMaxDice: 3,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const diceRuleSets = Object.freeze({
  [STANDARD_DICE_RULE_SET_ID]: standardDiceRuleSet,
  [DEFENSE_THREE_DICE_RULE_SET_ID]: defenseThreeDiceRuleSet
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
  DEFENSE_THREE_DICE_RULE_SET_ID,
  STANDARD_DICE_RULE_SET_ID,
  defenseThreeDiceRuleSet,
  findDiceRuleSet,
  getDiceRuleSet,
  listDiceRuleSets,
  standardDiceRuleSet
};
