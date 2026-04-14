import { createModuleRegistry } from "./module-registry.cjs";

export const STANDARD_DICE_RULE_SET_ID = "standard";
export const DEFENSE_THREE_DICE_RULE_SET_ID = "defense-3";

export type DiceRuleSetId = string;

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

const diceRuleSetRegistry = createModuleRegistry<DiceRuleSet>([
  standardDiceRuleSet,
  defenseThreeDiceRuleSet
]);

export function findDiceRuleSet(ruleSetId: string | null | undefined): Readonly<DiceRuleSet> | null {
  return diceRuleSetRegistry.find(ruleSetId);
}

export function getDiceRuleSet(ruleSetId: string = STANDARD_DICE_RULE_SET_ID): Readonly<DiceRuleSet> {
  const resolvedRuleSet = diceRuleSetRegistry.find(ruleSetId);

  if (!resolvedRuleSet || resolvedRuleSet.id === STANDARD_DICE_RULE_SET_ID) {
    return standardDiceRuleSet;
  }

  if (resolvedRuleSet.id === DEFENSE_THREE_DICE_RULE_SET_ID) {
    return defenseThreeDiceRuleSet;
  }

  return resolvedRuleSet;
}

export function listDiceRuleSets(): DiceRuleSetSummary[] {
  return diceRuleSetRegistry.entries.map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    attackerMaxDice: ruleSet.attackerMaxDice,
    defenderMaxDice: ruleSet.defenderMaxDice
  }));
}
