export const NETRISK_ENGINE_VERSION = "1.0.0";
export const NETRISK_MODULE_MANIFEST_SCHEMA_VERSION = 1;
export const NETRISK_MODULE_SCHEMA_VERSION = 1;
export const CORE_MODULE_ID = "core.base";
export const CORE_MODULE_VERSION = "1.0.0";

export type NetRiskModuleKind = "content" | "gameplay" | "ui" | "hybrid";
export type NetRiskModuleStatus = "discovered" | "validated" | "enabled" | "disabled" | "incompatible" | "error";
export type NetRiskUiSlotKind = "badge" | "panel" | "nav-item" | "page-section" | "admin-card" | "widget";

export interface NetRiskModuleCapability {
  kind: string;
  targetId?: string | null;
  hook?: string | null;
  scope?: "global" | "game";
  description?: string | null;
}

export interface NetRiskModuleDependency {
  id: string;
  version?: string | null;
  optional?: boolean;
}

export interface NetRiskModuleEntrypoints {
  server?: string | null;
  clientManifest?: string | null;
}

export interface NetRiskModuleManifest {
  schemaVersion: number;
  id: string;
  version: string;
  displayName: string;
  description?: string | null;
  engineVersion: string;
  kind: NetRiskModuleKind;
  dependencies: NetRiskModuleDependency[];
  conflicts: string[];
  capabilities: NetRiskModuleCapability[];
  entrypoints?: NetRiskModuleEntrypoints | null;
  assetsDir?: string | null;
  migrations?: string[];
  permissions?: string[];
}

export interface NetRiskModuleReference {
  id: string;
  version: string;
}

export interface NetRiskModuleProfile {
  id: string;
  name: string;
  description?: string | null;
  moduleId?: string | null;
}

export interface NetRiskGamePreset {
  id: string;
  name: string;
  description?: string | null;
  moduleId?: string | null;
  activeModuleIds?: string[];
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
  defaults?: NetRiskModuleConfigDefaults | null;
}

export interface NetRiskUiSlotContribution {
  slotId: string;
  itemId: string;
  title: string;
  kind: NetRiskUiSlotKind;
  order?: number;
  description?: string | null;
  route?: string | null;
}

export interface NetRiskUiContribution {
  slots: NetRiskUiSlotContribution[];
  themeTokens?: string[];
  stylesheets?: string[];
  locales?: string[];
}

export interface NetRiskGameplayContribution {
  hooks?: string[];
  profileIds?: string[];
}

export interface NetRiskContentContribution {
  mapIds?: string[];
  siteThemeIds?: string[];
  pieceSkinIds?: string[];
  playerPieceSetIds?: string[];
  contentPackIds?: string[];
  diceRuleSetIds?: string[];
  cardRuleSetIds?: string[];
  victoryRuleSetIds?: string[];
  fortifyRuleSetIds?: string[];
  reinforcementRuleSetIds?: string[];
}

export interface NetRiskModuleClientManifest {
  ui?: NetRiskUiContribution | null;
  gameplay?: NetRiskGameplayContribution | null;
  content?: NetRiskContentContribution | null;
  gamePresets?: NetRiskGamePreset[] | null;
  profiles?: {
    content?: NetRiskModuleProfile[];
    gameplay?: NetRiskModuleProfile[];
    ui?: NetRiskModuleProfile[];
  } | null;
}

export interface NetRiskInstalledModule {
  id: string;
  version: string | null;
  displayName: string;
  description?: string | null;
  kind: NetRiskModuleKind | null;
  sourcePath: string;
  status: NetRiskModuleStatus;
  enabled: boolean;
  compatible: boolean;
  manifest: NetRiskModuleManifest | null;
  capabilities: NetRiskModuleCapability[];
  warnings: string[];
  errors: string[];
  clientManifestPath?: string | null;
  clientManifest?: NetRiskModuleClientManifest | null;
}

export interface NetRiskEnabledModuleSet {
  ids: string[];
  refs: NetRiskModuleReference[];
  updatedAt?: string | null;
}

export interface NetRiskGameModuleSelection {
  moduleSchemaVersion: number;
  activeModules: NetRiskModuleReference[];
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
}

export interface NetRiskModuleConfigDefaults {
  contentPackId?: string | null;
  ruleSetId?: string | null;
  pieceSetId?: string | null;
  mapId?: string | null;
  diceRuleSetId?: string | null;
  victoryRuleSetId?: string | null;
  themeId?: string | null;
  pieceSkinId?: string | null;
}

export interface NetRiskReinforcementAdjustment {
  id?: string | null;
  label: string;
  flatBonus?: number | null;
  minimumTotal?: number | null;
}

export interface NetRiskGameplayEffects {
  reinforcementAdjustments?: NetRiskReinforcementAdjustment[];
  majorityControlThresholdPercent?: number | null;
  conquestMinimumArmies?: number | null;
  fortifyMinimumArmies?: number | null;
  requiredFortifyWhenAvailable?: boolean | null;
  attackMinimumArmies?: number | null;
  attackLimitPerTurn?: number | null;
  minimumAttacksPerTurn?: number | null;
}

export interface NetRiskScenarioTerritoryBonus {
  territoryId: string;
  armies: number;
}

export interface NetRiskScenarioSetup {
  territoryBonuses?: NetRiskScenarioTerritoryBonus[];
  logMessage?: string | null;
}

export interface NetRiskServerProfile {
  id: string;
  defaults?: NetRiskModuleConfigDefaults | null;
  gameplayEffects?: NetRiskGameplayEffects | null;
  scenarioSetup?: NetRiskScenarioSetup | null;
}

export interface NetRiskResolvedModuleSetup {
  defaults?: NetRiskModuleConfigDefaults | null;
  gameplayEffects?: NetRiskGameplayEffects | null;
  scenarioSetup?: NetRiskScenarioSetup | null;
}

export interface NetRiskResolvedGamePreset {
  id: string;
  name: string;
  description?: string | null;
  moduleId?: string | null;
  activeModuleIds?: string[];
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
  defaults?: NetRiskModuleConfigDefaults | null;
}

export interface NetRiskServerModule {
  profiles?: {
    content?: NetRiskServerProfile[];
    gameplay?: NetRiskServerProfile[];
    ui?: NetRiskServerProfile[];
  } | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeCapability(raw: unknown, sourcePath: string): NetRiskModuleCapability {
  if (!isObject(raw) || !isNonEmptyString(raw.kind)) {
    throw new Error(`Invalid module capability in "${sourcePath}".`);
  }

  return {
    kind: String(raw.kind).trim(),
    targetId: isNonEmptyString(raw.targetId) ? String(raw.targetId).trim() : null,
    hook: isNonEmptyString(raw.hook) ? String(raw.hook).trim() : null,
    scope: raw.scope === "game" ? "game" : "global",
    description: isNonEmptyString(raw.description) ? String(raw.description).trim() : null
  };
}

function normalizeDependency(raw: unknown, sourcePath: string): NetRiskModuleDependency {
  if (!isObject(raw) || !isNonEmptyString(raw.id)) {
    throw new Error(`Invalid module dependency in "${sourcePath}".`);
  }

  return {
    id: String(raw.id).trim(),
    version: isNonEmptyString(raw.version) ? String(raw.version).trim() : null,
    optional: Boolean(raw.optional)
  };
}

function normalizeUiSlot(raw: unknown, sourcePath: string): NetRiskUiSlotContribution {
  if (!isObject(raw) || !isNonEmptyString(raw.slotId) || !isNonEmptyString(raw.itemId) || !isNonEmptyString(raw.title)) {
    throw new Error(`Invalid UI slot contribution in "${sourcePath}".`);
  }

  const kind = raw.kind;
  if (kind !== "badge" && kind !== "panel" && kind !== "nav-item" && kind !== "page-section" && kind !== "admin-card" && kind !== "widget") {
    throw new Error(`Invalid UI slot kind in "${sourcePath}".`);
  }

  return {
    slotId: String(raw.slotId).trim(),
    itemId: String(raw.itemId).trim(),
    title: String(raw.title).trim(),
    kind,
    order: typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : 0,
    description: isNonEmptyString(raw.description) ? String(raw.description).trim() : null,
    route: isNonEmptyString(raw.route) ? String(raw.route).trim() : null
  };
}

function normalizeProfiles(raw: unknown): NetRiskModuleProfile[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry) => isObject(entry) && isNonEmptyString(entry.id) && isNonEmptyString(entry.name))
    .map((entry) => ({
      id: String(entry.id).trim(),
      name: String(entry.name).trim(),
      description: isNonEmptyString(entry.description) ? String(entry.description).trim() : null,
      moduleId: isNonEmptyString(entry.moduleId) ? String(entry.moduleId).trim() : null
    }));
}

function normalizeGamePresets(raw: unknown): NetRiskGamePreset[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry) => {
    if (!isObject(entry) || !isNonEmptyString(entry.id) || !isNonEmptyString(entry.name)) {
      throw new Error("Invalid module game preset contribution.");
    }

    return {
      id: String(entry.id).trim(),
      name: String(entry.name).trim(),
      description: isNonEmptyString(entry.description) ? String(entry.description).trim() : null,
      moduleId: isNonEmptyString(entry.moduleId) ? String(entry.moduleId).trim() : null,
      activeModuleIds: normalizeStringArray(entry.activeModuleIds),
      contentProfileId: isNonEmptyString(entry.contentProfileId) ? String(entry.contentProfileId).trim() : null,
      gameplayProfileId: isNonEmptyString(entry.gameplayProfileId) ? String(entry.gameplayProfileId).trim() : null,
      uiProfileId: isNonEmptyString(entry.uiProfileId) ? String(entry.uiProfileId).trim() : null,
      defaults: normalizeModuleConfigDefaults(entry.defaults)
    };
  });
}

function normalizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((value) => isNonEmptyString(value)).map((value) => String(value).trim())
    : [];
}

function normalizeModuleConfigDefaults(raw: unknown): NetRiskModuleConfigDefaults | null {
  if (!isObject(raw)) {
    return null;
  }

  return {
    contentPackId: isNonEmptyString(raw.contentPackId) ? String(raw.contentPackId).trim() : null,
    ruleSetId: isNonEmptyString(raw.ruleSetId) ? String(raw.ruleSetId).trim() : null,
    pieceSetId: isNonEmptyString(raw.pieceSetId) ? String(raw.pieceSetId).trim() : null,
    mapId: isNonEmptyString(raw.mapId) ? String(raw.mapId).trim() : null,
    diceRuleSetId: isNonEmptyString(raw.diceRuleSetId) ? String(raw.diceRuleSetId).trim() : null,
    victoryRuleSetId: isNonEmptyString(raw.victoryRuleSetId) ? String(raw.victoryRuleSetId).trim() : null,
    themeId: isNonEmptyString(raw.themeId) ? String(raw.themeId).trim() : null,
    pieceSkinId: isNonEmptyString(raw.pieceSkinId) ? String(raw.pieceSkinId).trim() : null
  };
}

function normalizeGameplayEffects(raw: unknown, sourcePath: string): NetRiskGameplayEffects | null {
  if (!isObject(raw)) {
    return null;
  }

  const reinforcementAdjustments = Array.isArray(raw.reinforcementAdjustments)
    ? raw.reinforcementAdjustments.map((entry) => {
        if (!isObject(entry) || !isNonEmptyString(entry.label)) {
          throw new Error(`Invalid reinforcement adjustment in "${sourcePath}".`);
        }

        const hasFlatBonus = typeof entry.flatBonus !== "undefined";
        const hasMinimumTotal = typeof entry.minimumTotal !== "undefined";
        const flatBonus = hasFlatBonus ? Number(entry.flatBonus) : null;
        const minimumTotal = hasMinimumTotal ? Number(entry.minimumTotal) : null;

        if (!hasFlatBonus && !hasMinimumTotal) {
          throw new Error(`Reinforcement adjustment in "${sourcePath}" must define flatBonus or minimumTotal.`);
        }

        if (hasFlatBonus && (!Number.isInteger(flatBonus) || (flatBonus as number) < 0)) {
          throw new Error(`Invalid reinforcement flatBonus in "${sourcePath}".`);
        }

        if (hasMinimumTotal && (!Number.isInteger(minimumTotal) || (minimumTotal as number) < 1)) {
          throw new Error(`Invalid reinforcement minimumTotal in "${sourcePath}".`);
        }

        return {
          id: isNonEmptyString(entry.id) ? String(entry.id).trim() : null,
          label: String(entry.label).trim(),
          flatBonus,
          minimumTotal
        };
      })
    : [];

  const hasMajorityControlThresholdPercent = typeof raw.majorityControlThresholdPercent !== "undefined";
  const majorityControlThresholdPercent = hasMajorityControlThresholdPercent ? Number(raw.majorityControlThresholdPercent) : null;
  const hasConquestMinimumArmies = typeof raw.conquestMinimumArmies !== "undefined";
  const conquestMinimumArmies = hasConquestMinimumArmies ? Number(raw.conquestMinimumArmies) : null;
  const hasFortifyMinimumArmies = typeof raw.fortifyMinimumArmies !== "undefined";
  const fortifyMinimumArmies = hasFortifyMinimumArmies ? Number(raw.fortifyMinimumArmies) : null;
  const hasRequiredFortifyWhenAvailable = typeof raw.requiredFortifyWhenAvailable !== "undefined";
  const requiredFortifyWhenAvailable = hasRequiredFortifyWhenAvailable ? Boolean(raw.requiredFortifyWhenAvailable) : null;
  const hasAttackMinimumArmies = typeof raw.attackMinimumArmies !== "undefined";
  const attackMinimumArmies = hasAttackMinimumArmies ? Number(raw.attackMinimumArmies) : null;
  const hasAttackLimitPerTurn = typeof raw.attackLimitPerTurn !== "undefined";
  const attackLimitPerTurn = hasAttackLimitPerTurn ? Number(raw.attackLimitPerTurn) : null;
  const hasMinimumAttacksPerTurn = typeof raw.minimumAttacksPerTurn !== "undefined";
  const minimumAttacksPerTurn = hasMinimumAttacksPerTurn ? Number(raw.minimumAttacksPerTurn) : null;

  if (hasMajorityControlThresholdPercent && (!Number.isInteger(majorityControlThresholdPercent) || (majorityControlThresholdPercent as number) < 50 || (majorityControlThresholdPercent as number) > 100)) {
    throw new Error(`Invalid majorityControlThresholdPercent in "${sourcePath}".`);
  }

  if (hasConquestMinimumArmies && (!Number.isInteger(conquestMinimumArmies) || (conquestMinimumArmies as number) < 1)) {
    throw new Error(`Invalid conquestMinimumArmies in "${sourcePath}".`);
  }

  if (hasFortifyMinimumArmies && (!Number.isInteger(fortifyMinimumArmies) || (fortifyMinimumArmies as number) < 1)) {
    throw new Error(`Invalid fortifyMinimumArmies in "${sourcePath}".`);
  }

  if (hasRequiredFortifyWhenAvailable && typeof raw.requiredFortifyWhenAvailable !== "boolean") {
    throw new Error(`Invalid requiredFortifyWhenAvailable in "${sourcePath}".`);
  }

  if (hasAttackMinimumArmies && (!Number.isInteger(attackMinimumArmies) || (attackMinimumArmies as number) < 2)) {
    throw new Error(`Invalid attackMinimumArmies in "${sourcePath}".`);
  }

  if (hasAttackLimitPerTurn && (!Number.isInteger(attackLimitPerTurn) || (attackLimitPerTurn as number) < 1)) {
    throw new Error(`Invalid attackLimitPerTurn in "${sourcePath}".`);
  }

  if (hasMinimumAttacksPerTurn && (!Number.isInteger(minimumAttacksPerTurn) || (minimumAttacksPerTurn as number) < 1)) {
    throw new Error(`Invalid minimumAttacksPerTurn in "${sourcePath}".`);
  }

  return {
    reinforcementAdjustments,
    majorityControlThresholdPercent,
    conquestMinimumArmies,
    fortifyMinimumArmies,
    requiredFortifyWhenAvailable,
    attackMinimumArmies,
    attackLimitPerTurn,
    minimumAttacksPerTurn
  };
}

function normalizeServerProfiles(raw: unknown, sourcePath: string): NetRiskServerProfile[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry) => {
    if (!isObject(entry) || !isNonEmptyString(entry.id)) {
      throw new Error(`Invalid server profile contribution in "${sourcePath}".`);
    }

    return {
      id: String(entry.id).trim(),
      defaults: normalizeModuleConfigDefaults(entry.defaults),
      gameplayEffects: normalizeGameplayEffects(entry.gameplayEffects, sourcePath),
      scenarioSetup: normalizeScenarioSetup(entry.scenarioSetup, sourcePath)
    };
  });
}

function normalizeScenarioSetup(raw: unknown, sourcePath: string): NetRiskScenarioSetup | null {
  if (!isObject(raw)) {
    return null;
  }

  const territoryBonuses = Array.isArray(raw.territoryBonuses)
    ? raw.territoryBonuses.map((entry) => {
        if (!isObject(entry) || !isNonEmptyString(entry.territoryId)) {
          throw new Error(`Invalid scenario territory bonus in "${sourcePath}".`);
        }

        const armies = Number(entry.armies);
        if (!Number.isInteger(armies) || armies < 1) {
          throw new Error(`Invalid scenario territory bonus armies in "${sourcePath}".`);
        }

        return {
          territoryId: String(entry.territoryId).trim(),
          armies
        };
      })
    : [];

  return {
    territoryBonuses,
    logMessage: isNonEmptyString(raw.logMessage) ? String(raw.logMessage).trim() : null
  };
}

export function validateNetRiskModuleManifest(raw: unknown, sourcePath: string): NetRiskModuleManifest {
  if (!isObject(raw)) {
    throw new Error(`Module manifest "${sourcePath}" must contain an object.`);
  }

  const schemaVersion = Number(raw.schemaVersion);
  if (!Number.isInteger(schemaVersion) || schemaVersion !== NETRISK_MODULE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Module manifest "${sourcePath}" uses unsupported schema version.`);
  }

  const kind = raw.kind;
  if (kind !== "content" && kind !== "gameplay" && kind !== "ui" && kind !== "hybrid") {
    throw new Error(`Module manifest "${sourcePath}" has unsupported kind.`);
  }

  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.version) || !isNonEmptyString(raw.displayName) || !isNonEmptyString(raw.engineVersion)) {
    throw new Error(`Module manifest "${sourcePath}" is missing required string fields.`);
  }

  return {
    schemaVersion,
    id: String(raw.id).trim(),
    version: String(raw.version).trim(),
    displayName: String(raw.displayName).trim(),
    description: isNonEmptyString(raw.description) ? String(raw.description).trim() : null,
    engineVersion: String(raw.engineVersion).trim(),
    kind,
    dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.map((entry) => normalizeDependency(entry, sourcePath)) : [],
    conflicts: normalizeStringArray(raw.conflicts),
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.map((entry) => normalizeCapability(entry, sourcePath)) : [],
    entrypoints: isObject(raw.entrypoints)
      ? {
          server: isNonEmptyString(raw.entrypoints.server) ? String(raw.entrypoints.server).trim() : null,
          clientManifest: isNonEmptyString(raw.entrypoints.clientManifest) ? String(raw.entrypoints.clientManifest).trim() : null
        }
      : null,
    assetsDir: isNonEmptyString(raw.assetsDir) ? String(raw.assetsDir).trim() : null,
    migrations: normalizeStringArray(raw.migrations),
    permissions: normalizeStringArray(raw.permissions)
  };
}

export function validateNetRiskModuleClientManifest(raw: unknown, sourcePath: string): NetRiskModuleClientManifest {
  if (!isObject(raw)) {
    throw new Error(`Module client manifest "${sourcePath}" must contain an object.`);
  }

  const ui = isObject(raw.ui)
    ? {
        slots: Array.isArray(raw.ui.slots) ? raw.ui.slots.map((entry) => normalizeUiSlot(entry, sourcePath)) : [],
        themeTokens: normalizeStringArray(raw.ui.themeTokens),
        stylesheets: normalizeStringArray(raw.ui.stylesheets),
        locales: normalizeStringArray(raw.ui.locales)
      }
    : null;

  const gameplay = isObject(raw.gameplay)
    ? {
        hooks: normalizeStringArray(raw.gameplay.hooks),
        profileIds: normalizeStringArray(raw.gameplay.profileIds)
      }
    : null;

  const content = isObject(raw.content)
    ? {
        mapIds: normalizeStringArray(raw.content.mapIds),
        siteThemeIds: normalizeStringArray(raw.content.siteThemeIds),
        pieceSkinIds: normalizeStringArray(raw.content.pieceSkinIds),
        playerPieceSetIds: normalizeStringArray(raw.content.playerPieceSetIds),
        contentPackIds: normalizeStringArray(raw.content.contentPackIds),
        diceRuleSetIds: normalizeStringArray(raw.content.diceRuleSetIds),
        cardRuleSetIds: normalizeStringArray(raw.content.cardRuleSetIds),
        victoryRuleSetIds: normalizeStringArray(raw.content.victoryRuleSetIds),
        fortifyRuleSetIds: normalizeStringArray(raw.content.fortifyRuleSetIds),
        reinforcementRuleSetIds: normalizeStringArray(raw.content.reinforcementRuleSetIds)
      }
    : null;

  const profiles = isObject(raw.profiles)
    ? {
        content: normalizeProfiles(raw.profiles.content),
        gameplay: normalizeProfiles(raw.profiles.gameplay),
        ui: normalizeProfiles(raw.profiles.ui)
      }
    : null;

  return {
    ui,
    gameplay,
    content,
    gamePresets: normalizeGamePresets(raw.gamePresets),
    profiles
  };
}

export function validateNetRiskServerModule(raw: unknown, sourcePath: string): NetRiskServerModule {
  if (!isObject(raw)) {
    throw new Error(`Module server entrypoint "${sourcePath}" must export an object.`);
  }

  const profiles = isObject(raw.profiles)
    ? {
        content: normalizeServerProfiles(raw.profiles.content, sourcePath),
        gameplay: normalizeServerProfiles(raw.profiles.gameplay, sourcePath),
        ui: normalizeServerProfiles(raw.profiles.ui, sourcePath)
      }
    : null;

  return {
    profiles
  };
}

export function parseSemverMajor(version: string | null | undefined): number | null {
  if (!isNonEmptyString(version)) {
    return null;
  }

  const match = String(version).trim().match(/^(\d+)(?:\.\d+)?(?:\.\d+)?/);
  return match ? Number(match[1]) : null;
}

export function isEngineVersionCompatible(engineVersion: string, requestedVersion: string): boolean {
  const engineMajor = parseSemverMajor(engineVersion);
  const requestedMajor = parseSemverMajor(requestedVersion);
  if (engineMajor == null || requestedMajor == null) {
    return false;
  }

  return engineMajor === requestedMajor;
}

export function createModuleReference(id: string, version: string): NetRiskModuleReference {
  return {
    id: String(id || "").trim(),
    version: String(version || "").trim()
  };
}

export function uniqueModuleReferences(references: readonly NetRiskModuleReference[]): NetRiskModuleReference[] {
  const byId = new Map<string, NetRiskModuleReference>();
  references.forEach((reference) => {
    if (!isNonEmptyString(reference?.id) || !isNonEmptyString(reference?.version)) {
      return;
    }
    byId.set(reference.id, createModuleReference(reference.id, reference.version));
  });
  return Array.from(byId.values());
}

export function coreModuleReference(): NetRiskModuleReference {
  return createModuleReference(CORE_MODULE_ID, CORE_MODULE_VERSION);
}

export function normalizeNetRiskGameModuleSelection(
  input: Partial<NetRiskGameModuleSelection> | null | undefined,
  fallbackActiveModules: NetRiskModuleReference[] = [coreModuleReference()]
): NetRiskGameModuleSelection {
  const activeModules = uniqueModuleReferences(
    Array.isArray(input?.activeModules) && input?.activeModules.length
      ? input.activeModules
      : fallbackActiveModules
  );

  if (!activeModules.some((reference) => reference.id === CORE_MODULE_ID)) {
    activeModules.unshift(coreModuleReference());
  }

  return {
    moduleSchemaVersion: NETRISK_MODULE_SCHEMA_VERSION,
    activeModules,
    contentProfileId: isNonEmptyString(input?.contentProfileId) ? String(input?.contentProfileId).trim() : null,
    gameplayProfileId: isNonEmptyString(input?.gameplayProfileId) ? String(input?.gameplayProfileId).trim() : null,
    uiProfileId: isNonEmptyString(input?.uiProfileId) ? String(input?.uiProfileId).trim() : null
  };
}
