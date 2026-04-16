import { createLocalizedError } from "./messages.cjs";
import { createModuleRegistry } from "./module-registry.cjs";

export const STANDARD_FORTIFY_RULE_SET_ID = "standard";

export interface FortifyRuleSet {
  id: string;
  name: string;
  description: string;
  requiresAdjacency: boolean;
  enforceSingleMovePerTurn: boolean;
  requireLeaveOneBehind: boolean;
}

export interface FortifyRuleSetSummary {
  id: string;
  name: string;
  description: string;
}

export const standardFortifyRuleSet: Readonly<FortifyRuleSet> = Object.freeze({
  id: STANDARD_FORTIFY_RULE_SET_ID,
  name: "Standard",
  description:
    "Fortify once per turn between adjacent owned territories while leaving one army behind.",
  requiresAdjacency: true,
  enforceSingleMovePerTurn: true,
  requireLeaveOneBehind: true
});

const fortifyRuleSetRegistry = createModuleRegistry<FortifyRuleSet>([standardFortifyRuleSet], {
  onMissing(ruleSetId) {
    throw createLocalizedError("Unsupported fortify rule set.", "game.fortify.unsupportedRuleSet", {
      ruleSetId
    });
  }
});

export function findFortifyRuleSet(
  ruleSetId: string | null | undefined
): Readonly<FortifyRuleSet> | null {
  return fortifyRuleSetRegistry.find(ruleSetId);
}

export function getFortifyRuleSet(
  ruleSetId: string = STANDARD_FORTIFY_RULE_SET_ID
): Readonly<FortifyRuleSet> {
  return fortifyRuleSetRegistry.get(ruleSetId, STANDARD_FORTIFY_RULE_SET_ID);
}

export function listFortifyRuleSets(): FortifyRuleSetSummary[] {
  return fortifyRuleSetRegistry.entries.map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    description: ruleSet.description
  }));
}
