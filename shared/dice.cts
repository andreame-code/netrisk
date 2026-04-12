export const STANDARD_DICE_RULE_SET_ID = "standard";
export const DEFENSE_THREE_DICE_RULE_SET_ID = "defense-3";

export type DiceRuleSetId =
  | typeof STANDARD_DICE_RULE_SET_ID
  | typeof DEFENSE_THREE_DICE_RULE_SET_ID;

export interface DiceRuleSet {
  id: DiceRuleSetId;
  name: string;
  attackerMaxDice: number;
  defenderMaxDice: number;
  attackerMustLeaveOneArmyBehind: boolean;
  defenderWinsTies: boolean;
}

export interface DiceRuleSetSummary {
  id: DiceRuleSetId;
  name: string;
  attackerMaxDice: number;
  defenderMaxDice: number;
}

export const standardDiceRuleSet: Readonly<DiceRuleSet> = Object.freeze({
  id: STANDARD_DICE_RULE_SET_ID,
  name: "Standard",
  attackerMaxDice: 3,
  defenderMaxDice: 2,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

export const defenseThreeDiceRuleSet: Readonly<DiceRuleSet> = Object.freeze({
  id: DEFENSE_THREE_DICE_RULE_SET_ID,
  name: "Defense 3 Dice",
  attackerMaxDice: 3,
  defenderMaxDice: 3,
  attackerMustLeaveOneArmyBehind: true,
  defenderWinsTies: true
});

const diceRuleSets: Readonly<Record<DiceRuleSetId, Readonly<DiceRuleSet>>> = Object.freeze({
  [STANDARD_DICE_RULE_SET_ID]: standardDiceRuleSet,
  [DEFENSE_THREE_DICE_RULE_SET_ID]: defenseThreeDiceRuleSet
});

export function findDiceRuleSet(ruleSetId: string | null | undefined): Readonly<DiceRuleSet> | null {
  if (!ruleSetId) {
    return null;
  }

  return diceRuleSets[ruleSetId as DiceRuleSetId] || null;
}

export function getDiceRuleSet(ruleSetId: string = STANDARD_DICE_RULE_SET_ID): Readonly<DiceRuleSet> {
  return findDiceRuleSet(ruleSetId) || standardDiceRuleSet;
}

export function listDiceRuleSets(): DiceRuleSetSummary[] {
  return Object.values(diceRuleSets).map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    attackerMaxDice: ruleSet.attackerMaxDice,
    defenderMaxDice: ruleSet.defenderMaxDice
  }));
}
