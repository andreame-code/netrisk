const STANDARD_DICE_RULE_SET_ID = "standard";

const standardDiceRuleSet = Object.freeze({
  id: STANDARD_DICE_RULE_SET_ID,
  attackerMaxDice: 3,
  defenderMaxDice: 2,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const diceRuleSets = Object.freeze({
  [STANDARD_DICE_RULE_SET_ID]: standardDiceRuleSet
});

function getDiceRuleSet(ruleSetId = STANDARD_DICE_RULE_SET_ID) {
  return diceRuleSets[ruleSetId] || standardDiceRuleSet;
}

module.exports = {
  STANDARD_DICE_RULE_SET_ID,
  getDiceRuleSet,
  standardDiceRuleSet
};
