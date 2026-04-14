import type { Continent } from "./core-domain.cjs";
import { createLocalizedError } from "./messages.cjs";
import { createModuleRegistry } from "./module-registry.cjs";

export const STANDARD_REINFORCEMENT_RULE_SET_ID = "standard";

export interface ReinforcementBonus {
  continentId: string | null;
  continentName: string;
  bonus: number;
  territoryIds: string[];
}

export interface ReinforcementResolution {
  baseReinforcements: number;
  minimumApplied: boolean;
  continentBonuses: ReinforcementBonus[];
  continentBonusTotal: number;
  totalReinforcements: number;
}

export interface ReinforcementRuleSet {
  id: string;
  name: string;
  description: string;
  resolve: (input: { territoryCount: number; controlledContinents: readonly Continent[] }) => ReinforcementResolution;
}

export interface ReinforcementRuleSetSummary {
  id: string;
  name: string;
  description: string;
}

export const standardReinforcementRuleSet: Readonly<ReinforcementRuleSet> = Object.freeze({
  id: STANDARD_REINFORCEMENT_RULE_SET_ID,
  name: "Standard",
  description: "Base reinforcements equal territories divided by 3 with a minimum of 3, plus full continent bonuses.",
  resolve(input: { territoryCount: number; controlledContinents: readonly Continent[] }) {
    const rawBaseReinforcements = Math.floor(input.territoryCount / 3);
    const baseReinforcements = Math.max(3, rawBaseReinforcements);
    const continentBonuses = input.controlledContinents.map((continent: Continent) => ({
      continentId: continent.id,
      continentName: continent.name,
      bonus: Number(continent.bonus) || 0,
      territoryIds: continent.territoryIds.slice()
    }));
    const continentBonusTotal = continentBonuses.reduce((total: number, entry: ReinforcementBonus) => total + entry.bonus, 0);

    return {
      baseReinforcements,
      minimumApplied: baseReinforcements !== rawBaseReinforcements,
      continentBonuses,
      continentBonusTotal,
      totalReinforcements: baseReinforcements + continentBonusTotal
    };
  }
});

const reinforcementRuleSetRegistry = createModuleRegistry<ReinforcementRuleSet>(
  [standardReinforcementRuleSet],
  {
    onMissing(ruleSetId) {
      throw createLocalizedError(
        "Unsupported reinforcement rule set.",
        "game.reinforcements.unsupportedRuleSet",
        { ruleSetId }
      );
    }
  }
);

export function findReinforcementRuleSet(ruleSetId: string | null | undefined): Readonly<ReinforcementRuleSet> | null {
  return reinforcementRuleSetRegistry.find(ruleSetId);
}

export function getReinforcementRuleSet(ruleSetId: string = STANDARD_REINFORCEMENT_RULE_SET_ID): Readonly<ReinforcementRuleSet> {
  return reinforcementRuleSetRegistry.get(ruleSetId, STANDARD_REINFORCEMENT_RULE_SET_ID);
}

export function listReinforcementRuleSets(): ReinforcementRuleSetSummary[] {
  return reinforcementRuleSetRegistry.entries.map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    description: ruleSet.description
  }));
}
