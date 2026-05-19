import type { NetRiskInstalledModule } from "../shared/netrisk-modules.cjs";

type RuntimeContributionEntry = {
  moduleId: string;
};

export type RuntimeCatalogProjection<
  TMapEntry extends RuntimeContributionEntry,
  TContentPackEntry extends RuntimeContributionEntry,
  TPlayerPieceSetEntry extends RuntimeContributionEntry,
  TDiceRuleSetEntry extends RuntimeContributionEntry,
  TSiteThemeEntry extends RuntimeContributionEntry
> = {
  enabledModules: NetRiskInstalledModule[];
  enabledRuntimeMapEntries: TMapEntry[];
  enabledRuntimeContentPackEntries: TContentPackEntry[];
  enabledRuntimePlayerPieceSetEntries: TPlayerPieceSetEntry[];
  enabledRuntimeDiceRuleSetEntries: TDiceRuleSetEntry[];
  enabledRuntimeSiteThemeEntries: TSiteThemeEntry[];
};

function enabledModuleIds(modules: NetRiskInstalledModule[]): Set<string> {
  return new Set(
    modules
      .filter((moduleEntry) => moduleEntry.enabled && moduleEntry.compatible)
      .map((moduleEntry) => moduleEntry.id)
  );
}

function entriesForEnabledModules<TEntry extends RuntimeContributionEntry>(
  entries: TEntry[],
  enabledIds: Set<string>
): TEntry[] {
  return entries.filter((entry) => enabledIds.has(entry.moduleId));
}

export function projectRuntimeCatalogInputs<
  TMapEntry extends RuntimeContributionEntry,
  TContentPackEntry extends RuntimeContributionEntry,
  TPlayerPieceSetEntry extends RuntimeContributionEntry,
  TDiceRuleSetEntry extends RuntimeContributionEntry,
  TSiteThemeEntry extends RuntimeContributionEntry
>(
  modules: NetRiskInstalledModule[],
  runtimeMapEntries: TMapEntry[],
  runtimeContentPackEntries: TContentPackEntry[],
  runtimePlayerPieceSetEntries: TPlayerPieceSetEntry[],
  runtimeDiceRuleSetEntries: TDiceRuleSetEntry[],
  runtimeSiteThemeEntries: TSiteThemeEntry[]
): RuntimeCatalogProjection<
  TMapEntry,
  TContentPackEntry,
  TPlayerPieceSetEntry,
  TDiceRuleSetEntry,
  TSiteThemeEntry
> {
  const enabledIds = enabledModuleIds(modules);

  return {
    enabledModules: modules.filter((moduleEntry) => enabledIds.has(moduleEntry.id)),
    enabledRuntimeMapEntries: entriesForEnabledModules(runtimeMapEntries, enabledIds),
    enabledRuntimeContentPackEntries: entriesForEnabledModules(
      runtimeContentPackEntries,
      enabledIds
    ),
    enabledRuntimePlayerPieceSetEntries: entriesForEnabledModules(
      runtimePlayerPieceSetEntries,
      enabledIds
    ),
    enabledRuntimeDiceRuleSetEntries: entriesForEnabledModules(
      runtimeDiceRuleSetEntries,
      enabledIds
    ),
    enabledRuntimeSiteThemeEntries: entriesForEnabledModules(runtimeSiteThemeEntries, enabledIds)
  };
}
