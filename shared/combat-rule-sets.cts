import { createLocalizedError } from "./messages.cjs";
import { createModuleRegistry } from "./module-registry.cjs";

export const STANDARD_COMBAT_RULE_SET_ID = "standard";

export interface CombatComparisonLike {
  winner: "attacker" | "defender";
}

export interface CombatOutcome {
  attackerLosses: number;
  defenderLosses: number;
}

export interface CombatRuleSet {
  id: string;
  name: string;
  description: string;
  resolveOutcome: (comparisons: readonly CombatComparisonLike[]) => CombatOutcome;
}

export interface CombatRuleSetSummary {
  id: string;
  name: string;
  description: string;
}

export const standardCombatRuleSet: Readonly<CombatRuleSet> = Object.freeze({
  id: STANDARD_COMBAT_RULE_SET_ID,
  name: "Standard",
  description: "Each dice comparison removes exactly one army from the losing side.",
  resolveOutcome(comparisons: readonly CombatComparisonLike[]) {
    return comparisons.reduce<CombatOutcome>((outcome, comparison) => {
      if (comparison.winner === "attacker") {
        outcome.defenderLosses += 1;
      } else {
        outcome.attackerLosses += 1;
      }

      return outcome;
    }, { attackerLosses: 0, defenderLosses: 0 });
  }
});

const combatRuleSetRegistry = createModuleRegistry<CombatRuleSet>(
  [standardCombatRuleSet],
  {
    onMissing(ruleSetId) {
      throw createLocalizedError(
        "Unsupported combat rule set.",
        "game.combat.unsupportedRuleSet",
        { ruleSetId }
      );
    }
  }
);

export function findCombatRuleSet(ruleSetId: string | null | undefined): Readonly<CombatRuleSet> | null {
  return combatRuleSetRegistry.find(ruleSetId);
}

export function getCombatRuleSet(ruleSetId: string = STANDARD_COMBAT_RULE_SET_ID): Readonly<CombatRuleSet> {
  return combatRuleSetRegistry.get(ruleSetId, STANDARD_COMBAT_RULE_SET_ID);
}

export function listCombatRuleSets(): CombatRuleSetSummary[] {
  return combatRuleSetRegistry.entries.map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    description: ruleSet.description
  }));
}
