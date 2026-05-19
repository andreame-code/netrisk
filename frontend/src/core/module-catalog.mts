import type {
  GameOptionsResponse,
  InstalledModuleSummary,
  ModuleOptionsResponse,
  NetRiskGamePreset,
  NetRiskModuleProfile,
  NetRiskUiSlotContribution,
  ResolvedModuleCatalog
} from "../generated/shared-runtime-validation.mjs";

type CatalogCarrier = {
  resolvedCatalog?: ResolvedModuleCatalog;
};

type GameModuleCarrier = CatalogCarrier & {
  modules?: InstalledModuleSummary[];
  gameModules?: InstalledModuleSummary[];
};

export function resolvedCatalog(
  payload: CatalogCarrier | null | undefined
): ResolvedModuleCatalog | null {
  return payload?.resolvedCatalog || null;
}

export function resolvedGamePresets(
  payload: GameOptionsResponse | ModuleOptionsResponse | null | undefined
): NetRiskGamePreset[] {
  return resolvedCatalog(payload)?.gamePresets || payload?.gamePresets || [];
}

export function resolvedGameModules(
  payload: GameModuleCarrier | null | undefined
): InstalledModuleSummary[] {
  return resolvedCatalog(payload)?.gameModules || payload?.gameModules || payload?.modules || [];
}

export function resolvedContentProfiles(
  payload: GameOptionsResponse | ModuleOptionsResponse | null | undefined
): NetRiskModuleProfile[] {
  return resolvedCatalog(payload)?.contentProfiles || payload?.contentProfiles || [];
}

export function resolvedGameplayProfiles(
  payload: GameOptionsResponse | ModuleOptionsResponse | null | undefined
): NetRiskModuleProfile[] {
  return resolvedCatalog(payload)?.gameplayProfiles || payload?.gameplayProfiles || [];
}

export function resolvedUiProfiles(
  payload: GameOptionsResponse | ModuleOptionsResponse | null | undefined
): NetRiskModuleProfile[] {
  return resolvedCatalog(payload)?.uiProfiles || payload?.uiProfiles || [];
}

export function resolvedUiSlots(
  payload: GameOptionsResponse | ModuleOptionsResponse | null | undefined
): NetRiskUiSlotContribution[] {
  return resolvedCatalog(payload)?.uiSlots || payload?.uiSlots || [];
}
