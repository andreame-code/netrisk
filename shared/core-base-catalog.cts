import {
  findBuiltInNewGameRuleSet,
  listBuiltInNewGameRuleSets,
  type BuiltInNewGameRuleSetSummary
} from "./extensions.cjs";
import {
  findSupportedMap,
  listSupportedMaps,
  type MapSummary,
  type SupportedMap
} from "./maps/index.cjs";

export function findCoreBaseNewGameRuleSet(
  ruleSetId: string | null | undefined
): BuiltInNewGameRuleSetSummary | null {
  return findBuiltInNewGameRuleSet(ruleSetId);
}

export function listCoreBaseNewGameRuleSets(): BuiltInNewGameRuleSetSummary[] {
  return listBuiltInNewGameRuleSets();
}

export function findCoreBaseSupportedMap(mapId: string | null | undefined): SupportedMap | null {
  return typeof mapId === "string" ? findSupportedMap(mapId) : null;
}

export function listCoreBaseMapSummaries(): MapSummary[] {
  return listSupportedMaps();
}
