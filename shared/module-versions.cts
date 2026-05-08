import {
  appVersion,
  datastoreSchemaVersion,
  minimumCompatibleModuleApiVersion,
  minimumCompatibleSaveGameSchemaVersion,
  moduleApiVersion,
  saveGameSchemaVersion
} from "./version-manifest.cjs";

export const MODULE_VERSION_MANIFEST_SCHEMA_VERSION = 1;

export type ModuleVersionBumpKind = "patch" | "minor" | "major";
export type FunctionalModuleKind =
  | "runtime-package"
  | "content"
  | "rule-family"
  | "gameplay"
  | "platform"
  | "admin"
  | "ui";

export interface SchemaVersionRange {
  min: number;
  max: number;
}

export interface FunctionalModuleVersion {
  id: string;
  name: string;
  kind: FunctionalModuleKind;
  version: string;
  description: string;
  ownerPaths: string[];
}

export interface ModuleVersionRequirement {
  moduleId: string;
  versions: string;
  optional?: boolean;
}

export interface ModuleCompatibilityDeclaration {
  moduleId: string;
  moduleVersions: string;
  compatibleAppVersions: string;
  compatibleSaveGameSchemaVersions: SchemaVersionRange;
  compatibleDatastoreSchemaVersions: SchemaVersionRange;
  compatibleModuleApiVersions: string;
  requires: ModuleVersionRequirement[];
  notes?: string;
}

export interface ModuleCompatibilityEnvironment {
  appVersion?: string;
  saveGameSchemaVersion?: number;
  datastoreSchemaVersion?: number;
  moduleApiVersion?: string;
  modules?: Record<string, string> | readonly ModuleVersionRequirement[];
}

export interface ModuleCompatibilityResult {
  compatible: boolean;
  errors: string[];
}

export interface ModuleVersionChangeRequirement {
  moduleId: string;
  moduleName: string;
  version: string;
  changedPaths: string[];
  versionChanged: boolean;
}

export const MODULE_VERSION_BUMP_RULES: Readonly<Record<ModuleVersionBumpKind, string>> =
  Object.freeze({
    patch:
      "Internal fixes that do not change public behavior, transport shape, saved-state compatibility, or module interoperability.",
    minor:
      "Backward-compatible feature additions, optional module behavior extensions, or additive admin/UI capabilities.",
    major:
      "Breaking behavior changes, saved-state incompatibility, public API/schema changes, required migrations, or compatibility changes that older consumers cannot use safely."
  });

export const functionalModuleVersions: readonly FunctionalModuleVersion[] = Object.freeze([
  {
    id: "core.base",
    name: "Core Base Runtime Module",
    kind: "runtime-package",
    version: "1.0.0",
    description: "Always-enabled first-party baseline module for official content and UI slots.",
    ownerPaths: ["modules/core.base/", "shared/core-base-catalog.cts"]
  },
  {
    id: "demo.command-center",
    name: "Command Center Demo Runtime Module",
    kind: "runtime-package",
    version: "1.0.0",
    description: "Installable demo module for catalog, profile, asset, and UI-slot flows.",
    ownerPaths: ["modules/demo.command-center/"]
  },
  {
    id: "maps",
    name: "Maps",
    kind: "content",
    version: "1.0.0",
    description: "Built-in map definitions, territory topology, continent data, and map loaders.",
    ownerPaths: [
      "shared/maps/",
      "shared/map-loader.cts",
      "shared/continent-loader.cts",
      "shared/map-graph.cts",
      "shared/typed-map-data.cts"
    ]
  },
  {
    id: "content-packs",
    name: "Content Packs",
    kind: "content",
    version: "1.0.0",
    description: "Composable setup defaults for maps, rules, themes, cards, dice, and pieces.",
    ownerPaths: [
      "shared/content-packs.cts",
      "shared/content/content-packs/",
      "shared/content-catalog.cts"
    ]
  },
  {
    id: "site-themes",
    name: "Site Themes",
    kind: "ui",
    version: "1.0.0",
    description: "Theme catalog entries and client-visible visual theme metadata.",
    ownerPaths: ["shared/site-themes.cts", "shared/content/site-themes/"]
  },
  {
    id: "player-piece-sets",
    name: "Player Piece Sets",
    kind: "content",
    version: "1.0.0",
    description: "Player color palettes and piece-set catalog entries.",
    ownerPaths: ["shared/player-piece-sets.cts", "shared/content/player-piece-sets/"]
  },
  {
    id: "piece-skins",
    name: "Piece Skins",
    kind: "ui",
    version: "1.0.0",
    description: "Board marker skin options and piece rendering metadata.",
    ownerPaths: ["shared/extensions.cts"]
  },
  {
    id: "dice-rule-sets",
    name: "Dice Rule Sets",
    kind: "rule-family",
    version: "1.0.0",
    description: "Dice resolution options shared by setup, runtime modules, and combat.",
    ownerPaths: ["shared/dice.cts", "backend/engine/combat-dice.cts"]
  },
  {
    id: "card-rule-sets",
    name: "Card Rule Sets",
    kind: "rule-family",
    version: "1.0.0",
    description: "Card deck, trade-in, and route-facing card rule-set behavior.",
    ownerPaths: ["shared/cards.cts", "backend/routes/game-cards.cts"]
  },
  {
    id: "combat-rule-sets",
    name: "Combat Rule Sets",
    kind: "gameplay",
    version: "1.0.0",
    description: "Attack validation, combat resolution, conquest, and banzai attack behavior.",
    ownerPaths: [
      "shared/combat-rule-sets.cts",
      "backend/engine/attack-validation.cts",
      "backend/engine/banzai-attack.cts",
      "backend/engine/combat-resolution.cts",
      "backend/engine/conquest-resolution.cts"
    ]
  },
  {
    id: "reinforcement-rule-sets",
    name: "Reinforcement Rule Sets",
    kind: "gameplay",
    version: "1.0.0",
    description: "Reinforcement calculation and placement behavior.",
    ownerPaths: [
      "shared/reinforcement-rule-sets.cts",
      "backend/engine/reinforcement-calculator.cts",
      "backend/engine/reinforcement-placement.cts"
    ]
  },
  {
    id: "fortify-rule-sets",
    name: "Fortify Rule Sets",
    kind: "gameplay",
    version: "1.0.0",
    description: "Fortification and movement rule behavior.",
    ownerPaths: ["shared/fortify-rule-sets.cts", "backend/engine/fortify-movement.cts"]
  },
  {
    id: "victory-rule-sets",
    name: "Victory Rule Sets",
    kind: "gameplay",
    version: "1.0.0",
    description: "Built-in and runtime-resolved victory detection behavior.",
    ownerPaths: [
      "shared/victory-rule-sets.cts",
      "backend/engine/victory-detection.cts",
      "backend/engine/victory-objectives.cts"
    ]
  },
  {
    id: "turn-timeouts",
    name: "Turn Timeouts",
    kind: "gameplay",
    version: "1.0.0",
    description: "Turn timeout policy and timeout engine behavior.",
    ownerPaths: ["shared/turn-timeouts.cts", "backend/engine/turn-timeout.cts"]
  },
  {
    id: "setup-flow",
    name: "Setup Flow",
    kind: "gameplay",
    version: "1.0.0",
    description: "New-game setup, setup defaults, profiles, and setup route behavior.",
    ownerPaths: [
      "backend/engine/game-setup.cts",
      "backend/routes/game-setup.cts",
      "backend/routes/setup.cts"
    ]
  },
  {
    id: "module-runtime",
    name: "Module Runtime",
    kind: "platform",
    version: "1.0.1",
    description:
      "Filesystem module discovery, validation, enablement, and resolved catalog output.",
    ownerPaths: [
      "backend/module-runtime.cts",
      "backend/module-runtime-contributions.cts",
      "backend/routes/modules.cts",
      "shared/netrisk-modules.cts"
    ]
  },
  {
    id: "authored-victory-objectives",
    name: "Authored Victory Objectives",
    kind: "admin",
    version: "1.0.0",
    description:
      "Content Studio authored victory objective drafts, validation, and runtime output.",
    ownerPaths: [
      "backend/authored-modules.cts",
      "backend/routes/admin-content-studio.cts",
      "docs/content-studio-victory-objectives.md"
    ]
  },
  {
    id: "admin-console",
    name: "Admin Console",
    kind: "admin",
    version: "1.0.0",
    description: "Admin routes and operational admin workflows.",
    ownerPaths: ["backend/routes/admin.cts", "docs/admin-console.md", "docs/admin-console-plan.md"]
  },
  {
    id: "datastore",
    name: "Datastore",
    kind: "platform",
    version: "1.0.0",
    description:
      "Game/session persistence, app state persistence, backups, and datastore schema use.",
    ownerPaths: [
      "backend/game-session-store.cts",
      "backend/datastore.cts",
      "backend/sqlite-datastore.cts",
      "scripts/backup-datastore.cts",
      "scripts/check-backup.cts",
      "supabase/"
    ]
  },
  {
    id: "public-state",
    name: "Public Game State",
    kind: "platform",
    version: "1.0.0",
    description: "Public/read API game state contracts, snapshots, and shared game models.",
    ownerPaths: [
      "shared/api-contracts.cts",
      "shared/models.cts",
      "shared/core-domain.cts",
      "backend/routes/game-read.cts",
      "backend/routes/game-overview.cts"
    ]
  },
  {
    id: "ai-players",
    name: "AI Players",
    kind: "gameplay",
    version: "1.0.0",
    description: "AI turn decisions and AI turn recovery behavior.",
    ownerPaths: ["backend/engine/ai-player.cts", "backend/engine/ai-turn-resume.cts"]
  }
] as FunctionalModuleVersion[]);

const currentSchemaRange = Object.freeze({
  min: minimumCompatibleSaveGameSchemaVersion,
  max: saveGameSchemaVersion
});

const currentDatastoreRange = Object.freeze({
  min: datastoreSchemaVersion,
  max: datastoreSchemaVersion
});

const baseCompatibility = {
  moduleVersions: "1.x",
  compatibleAppVersions: "0.1.x",
  compatibleSaveGameSchemaVersions: currentSchemaRange,
  compatibleDatastoreSchemaVersions: currentDatastoreRange,
  compatibleModuleApiVersions: `>=${minimumCompatibleModuleApiVersion} <=${moduleApiVersion}`
};

export const moduleCompatibility: readonly ModuleCompatibilityDeclaration[] = Object.freeze([
  {
    moduleId: "core.base",
    ...baseCompatibility,
    requires: [],
    notes: "Baseline module for first-party content and setup compatibility."
  },
  {
    moduleId: "demo.command-center",
    ...baseCompatibility,
    requires: [{ moduleId: "core.base", versions: "1.x" }]
  },
  {
    moduleId: "maps",
    ...baseCompatibility,
    requires: []
  },
  {
    moduleId: "content-packs",
    ...baseCompatibility,
    requires: [
      { moduleId: "maps", versions: "1.x" },
      { moduleId: "site-themes", versions: "1.x" },
      { moduleId: "player-piece-sets", versions: "1.x" },
      { moduleId: "dice-rule-sets", versions: "1.x" },
      { moduleId: "card-rule-sets", versions: "1.x" },
      { moduleId: "victory-rule-sets", versions: "1.x" }
    ]
  },
  {
    moduleId: "site-themes",
    ...baseCompatibility,
    requires: []
  },
  {
    moduleId: "player-piece-sets",
    ...baseCompatibility,
    requires: []
  },
  {
    moduleId: "piece-skins",
    ...baseCompatibility,
    requires: []
  },
  {
    moduleId: "dice-rule-sets",
    ...baseCompatibility,
    requires: []
  },
  {
    moduleId: "card-rule-sets",
    ...baseCompatibility,
    requires: []
  },
  {
    moduleId: "combat-rule-sets",
    ...baseCompatibility,
    requires: [{ moduleId: "dice-rule-sets", versions: "1.x" }]
  },
  {
    moduleId: "reinforcement-rule-sets",
    ...baseCompatibility,
    requires: [{ moduleId: "maps", versions: "1.x" }]
  },
  {
    moduleId: "fortify-rule-sets",
    ...baseCompatibility,
    requires: [{ moduleId: "maps", versions: "1.x" }]
  },
  {
    moduleId: "victory-rule-sets",
    ...baseCompatibility,
    requires: [{ moduleId: "maps", versions: "1.x", optional: true }]
  },
  {
    moduleId: "turn-timeouts",
    ...baseCompatibility,
    requires: []
  },
  {
    moduleId: "setup-flow",
    ...baseCompatibility,
    requires: [
      { moduleId: "core.base", versions: "1.x" },
      { moduleId: "content-packs", versions: "1.x" },
      { moduleId: "maps", versions: "1.x" },
      { moduleId: "dice-rule-sets", versions: "1.x" },
      { moduleId: "victory-rule-sets", versions: "1.x" },
      { moduleId: "site-themes", versions: "1.x" },
      { moduleId: "piece-skins", versions: "1.x" },
      { moduleId: "player-piece-sets", versions: "1.x" }
    ]
  },
  {
    moduleId: "module-runtime",
    ...baseCompatibility,
    requires: [{ moduleId: "core.base", versions: "1.x" }]
  },
  {
    moduleId: "authored-victory-objectives",
    ...baseCompatibility,
    requires: [
      { moduleId: "maps", versions: "1.x" },
      { moduleId: "victory-rule-sets", versions: "1.x" }
    ]
  },
  {
    moduleId: "admin-console",
    ...baseCompatibility,
    requires: [{ moduleId: "module-runtime", versions: "1.x" }]
  },
  {
    moduleId: "datastore",
    ...baseCompatibility,
    requires: []
  },
  {
    moduleId: "public-state",
    ...baseCompatibility,
    requires: [
      { moduleId: "core.base", versions: "1.x" },
      { moduleId: "module-runtime", versions: "1.x" }
    ]
  },
  {
    moduleId: "ai-players",
    ...baseCompatibility,
    requires: [
      { moduleId: "combat-rule-sets", versions: "1.x" },
      { moduleId: "reinforcement-rule-sets", versions: "1.x" },
      { moduleId: "fortify-rule-sets", versions: "1.x" },
      { moduleId: "victory-rule-sets", versions: "1.x" }
    ]
  }
] as ModuleCompatibilityDeclaration[]);

export const moduleVersionManifest = Object.freeze({
  schemaVersion: MODULE_VERSION_MANIFEST_SCHEMA_VERSION,
  appVersion,
  saveGameSchemaVersion,
  datastoreSchemaVersion,
  moduleApiVersion,
  bumpRules: MODULE_VERSION_BUMP_RULES,
  modules: functionalModuleVersions,
  compatibility: moduleCompatibility
});

type VersionParts = [number, number, number];
type VersionBound = {
  version: VersionParts;
  inclusive: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseVersionParts(version: string, allowPaddedPatch = false): VersionParts | null {
  const patchPattern = allowPaddedPatch ? "\\d+" : "0|[1-9]\\d*";
  const match = version
    .trim()
    .match(new RegExp(`^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(${patchPattern})$`));
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersionParts(left: VersionParts, right: VersionParts): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function isValidModuleSemver(version: unknown): version is string {
  return typeof version === "string" && parseVersionParts(version) !== null;
}

function isWildcardRange(range: string): boolean {
  return range === "*" || /^(\d+)\.x$/.test(range) || /^(\d+)\.(\d+)\.x$/.test(range);
}

function versionMatchesWildcard(version: string, range: string, allowPaddedPatch = false): boolean {
  const parts = parseVersionParts(version, allowPaddedPatch);
  if (!parts) {
    return false;
  }

  if (range === "*") {
    return true;
  }

  const majorOnly = range.match(/^(\d+)\.x$/);
  if (majorOnly) {
    return parts[0] === Number(majorOnly[1]);
  }

  const minorRange = range.match(/^(\d+)\.(\d+)\.x$/);
  return Boolean(
    minorRange && parts[0] === Number(minorRange[1]) && parts[1] === Number(minorRange[2])
  );
}

function parseComparator(token: string): { operator: string; version: VersionParts } | null {
  const match = token.match(/^(>=|>|<=|<)(.+)$/);
  if (!match) {
    return null;
  }

  const parsedVersion = parseVersionParts(match[2].trim(), true);
  return parsedVersion ? { operator: match[1], version: parsedVersion } : null;
}

function comparatorMatches(
  version: VersionParts,
  comparator: { operator: string; version: VersionParts }
): boolean {
  const comparison = compareVersionParts(version, comparator.version);
  switch (comparator.operator) {
    case ">":
      return comparison > 0;
    case ">=":
      return comparison >= 0;
    case "<":
      return comparison < 0;
    case "<=":
      return comparison <= 0;
    default:
      return false;
  }
}

export function isValidVersionRange(range: unknown): range is string {
  if (!isNonEmptyString(range)) {
    return false;
  }

  const normalized = range.trim();
  if (isWildcardRange(normalized) || parseVersionParts(normalized, true)) {
    return true;
  }

  const comparators = normalized.split(/\s+/).map(parseComparator);
  if (!comparators.length || comparators.some((entry) => !entry)) {
    return false;
  }

  const parsedComparators = comparators as Array<{ operator: string; version: VersionParts }>;
  let lower: VersionBound | null = null;
  let upper: VersionBound | null = null;
  for (const entry of parsedComparators) {
    if (entry.operator === ">" || entry.operator === ">=") {
      const inclusive = entry.operator === ">=";
      const comparison = lower ? compareVersionParts(entry.version, lower.version) : 1;
      if (!lower || comparison > 0) {
        lower = { version: entry.version, inclusive };
      } else if (comparison === 0 && lower.inclusive && !inclusive) {
        lower = { version: entry.version, inclusive };
      }
    }

    if (entry.operator === "<" || entry.operator === "<=") {
      const inclusive = entry.operator === "<=";
      const comparison = upper ? compareVersionParts(entry.version, upper.version) : -1;
      if (!upper || comparison < 0) {
        upper = { version: entry.version, inclusive };
      } else if (comparison === 0 && upper.inclusive && !inclusive) {
        upper = { version: entry.version, inclusive };
      }
    }
  }

  if (!lower || !upper) {
    return true;
  }

  const comparison = compareVersionParts(lower.version, upper.version);
  if (comparison !== 0) {
    return comparison < 0;
  }

  return lower.inclusive && upper.inclusive;
}

export function versionSatisfiesRange(
  version: unknown,
  range: unknown,
  options: { allowPaddedPatch?: boolean } = {}
): boolean {
  if (!isNonEmptyString(version) || !isNonEmptyString(range) || !isValidVersionRange(range)) {
    return false;
  }

  const normalizedRange = range.trim();
  if (isWildcardRange(normalizedRange)) {
    return versionMatchesWildcard(version.trim(), normalizedRange, options.allowPaddedPatch);
  }

  const exact = parseVersionParts(normalizedRange, true);
  const versionParts = parseVersionParts(version.trim(), options.allowPaddedPatch);
  if (!versionParts) {
    return false;
  }

  if (exact) {
    return compareVersionParts(versionParts, exact) === 0;
  }

  return normalizedRange
    .split(/\s+/)
    .map(parseComparator)
    .every((comparator) => Boolean(comparator && comparatorMatches(versionParts, comparator)));
}

function validateSchemaRange(
  range: SchemaVersionRange,
  label: string,
  moduleId: string,
  errors: string[]
): void {
  if (
    !isObject(range) ||
    !Number.isInteger(range.min) ||
    !Number.isInteger(range.max) ||
    range.min < 0 ||
    range.max < range.min
  ) {
    errors.push(`${moduleId} has an invalid ${label} schema range.`);
  }
}

export function listFunctionalModuleVersions(): FunctionalModuleVersion[] {
  return functionalModuleVersions.map((entry) => ({
    ...entry,
    ownerPaths: [...entry.ownerPaths]
  }));
}

export function getFunctionalModuleVersion(
  moduleId: string | null | undefined
): FunctionalModuleVersion | null {
  const match = functionalModuleVersions.find((entry) => entry.id === moduleId) || null;
  return match ? { ...match, ownerPaths: [...match.ownerPaths] } : null;
}

export function validateModuleVersionManifest(
  modules: readonly FunctionalModuleVersion[] = functionalModuleVersions,
  compatibility: readonly ModuleCompatibilityDeclaration[] = moduleCompatibility
): string[] {
  const errors: string[] = [];
  const moduleIds = new Set<string>();
  const moduleEntriesById = new Map<string, FunctionalModuleVersion>();
  const compatibilityIds = new Set<string>();

  modules.forEach((entry) => {
    if (!isNonEmptyString(entry.id)) {
      errors.push("Module version entries require a non-empty id.");
      return;
    }

    if (moduleIds.has(entry.id)) {
      errors.push(`Duplicate module version entry "${entry.id}".`);
    }
    moduleIds.add(entry.id);
    moduleEntriesById.set(entry.id, entry);

    if (!isNonEmptyString(entry.name)) {
      errors.push(`${entry.id} is missing a name.`);
    }

    if (!isValidModuleSemver(entry.version)) {
      errors.push(`${entry.id} has invalid SemVer "${String(entry.version)}".`);
    }

    if (!Array.isArray(entry.ownerPaths) || !entry.ownerPaths.length) {
      errors.push(`${entry.id} must define at least one owner path.`);
    } else {
      entry.ownerPaths.forEach((ownerPath) => {
        if (
          !isNonEmptyString(ownerPath) ||
          ownerPath.includes("\\") ||
          ownerPath.includes("..") ||
          ownerPath.startsWith("/")
        ) {
          errors.push(`${entry.id} has invalid owner path "${String(ownerPath)}".`);
        }
      });
    }
  });

  compatibility.forEach((entry) => {
    if (!moduleIds.has(entry.moduleId)) {
      errors.push(`Compatibility references unknown module "${entry.moduleId}".`);
      return;
    }

    if (compatibilityIds.has(entry.moduleId)) {
      errors.push(`Duplicate compatibility entry "${entry.moduleId}".`);
    }
    compatibilityIds.add(entry.moduleId);

    if (!isValidVersionRange(entry.moduleVersions)) {
      errors.push(`${entry.moduleId} has invalid module version range "${entry.moduleVersions}".`);
    } else {
      const moduleEntry = moduleEntriesById.get(entry.moduleId);
      if (
        moduleEntry &&
        isValidModuleSemver(moduleEntry.version) &&
        !versionSatisfiesRange(moduleEntry.version, entry.moduleVersions)
      ) {
        errors.push(
          `${entry.moduleId} version ${moduleEntry.version} is outside declared module version range "${entry.moduleVersions}".`
        );
      }
    }

    if (!isValidVersionRange(entry.compatibleAppVersions)) {
      errors.push(
        `${entry.moduleId} has invalid app version range "${entry.compatibleAppVersions}".`
      );
    }

    if (!isValidVersionRange(entry.compatibleModuleApiVersions)) {
      errors.push(
        `${entry.moduleId} has invalid module API version range "${entry.compatibleModuleApiVersions}".`
      );
    }

    validateSchemaRange(
      entry.compatibleSaveGameSchemaVersions,
      "save-game",
      entry.moduleId,
      errors
    );
    validateSchemaRange(
      entry.compatibleDatastoreSchemaVersions,
      "datastore",
      entry.moduleId,
      errors
    );

    if (!Array.isArray(entry.requires)) {
      errors.push(`${entry.moduleId} must define requires as an array.`);
    } else {
      entry.requires.forEach((requirement) => {
        if (!moduleIds.has(requirement.moduleId)) {
          errors.push(`${entry.moduleId} requires unknown module "${requirement.moduleId}".`);
        }

        if (!isValidVersionRange(requirement.versions)) {
          errors.push(
            `${entry.moduleId} requires ${requirement.moduleId} with invalid range "${requirement.versions}".`
          );
        }
      });
    }
  });

  moduleIds.forEach((moduleId) => {
    if (!compatibilityIds.has(moduleId)) {
      errors.push(`${moduleId} is missing a compatibility declaration.`);
    }
  });

  return errors;
}

export function assertValidModuleVersionManifest(): void {
  const errors = validateModuleVersionManifest();
  if (errors.length) {
    throw new Error(`Module version manifest is invalid:\n- ${errors.join("\n- ")}`);
  }
}

function normalizeEnvironmentModules(
  modules: ModuleCompatibilityEnvironment["modules"]
): Record<string, string> {
  if (!modules) {
    return {};
  }

  if (Array.isArray(modules)) {
    return modules.reduce<Record<string, string>>((accumulator, entry) => {
      if (isNonEmptyString(entry.moduleId) && isNonEmptyString(entry.versions)) {
        const knownModuleVersion = getFunctionalModuleVersion(entry.moduleId)?.version || null;
        accumulator[entry.moduleId] =
          knownModuleVersion && versionSatisfiesRange(knownModuleVersion, entry.versions)
            ? knownModuleVersion
            : entry.versions;
      }
      return accumulator;
    }, {});
  }

  return { ...(modules as Record<string, string>) };
}

export function checkModuleCompatibility(
  moduleId: string,
  moduleVersion: string,
  environment: ModuleCompatibilityEnvironment = {}
): ModuleCompatibilityResult {
  const errors: string[] = [];
  const moduleEntry = getFunctionalModuleVersion(moduleId);
  const compatibility = moduleCompatibility.find((entry) => entry.moduleId === moduleId) || null;
  const environmentModules = normalizeEnvironmentModules(environment.modules);

  if (!moduleEntry || !compatibility) {
    return {
      compatible: false,
      errors: [`Unknown module "${moduleId}".`]
    };
  }

  errors.push(
    ...collectModuleCompatibilitySurfaceErrors(moduleId, moduleVersion, compatibility, environment)
  );

  compatibility.requires.forEach((requirement) => {
    const providedVersion = environmentModules[requirement.moduleId];
    if (!providedVersion) {
      if (!requirement.optional) {
        errors.push(`${moduleId} requires ${requirement.moduleId} ${requirement.versions}.`);
      }
      return;
    }

    if (!versionSatisfiesRange(providedVersion, requirement.versions)) {
      errors.push(
        `${moduleId} requires ${requirement.moduleId} ${requirement.versions}, received ${providedVersion}.`
      );
    }
  });

  return {
    compatible: errors.length === 0,
    errors
  };
}

function collectModuleCompatibilitySurfaceErrors(
  moduleId: string,
  moduleVersion: string,
  compatibility: ModuleCompatibilityDeclaration,
  environment: Omit<ModuleCompatibilityEnvironment, "modules">
): string[] {
  const errors: string[] = [];

  if (!versionSatisfiesRange(moduleVersion, compatibility.moduleVersions)) {
    errors.push(`${moduleId} version ${moduleVersion} is outside ${compatibility.moduleVersions}.`);
  }

  const requestedAppVersion = environment.appVersion || appVersion;
  if (
    !versionSatisfiesRange(requestedAppVersion, compatibility.compatibleAppVersions, {
      allowPaddedPatch: true
    })
  ) {
    errors.push(
      `${moduleId} is not compatible with app version ${requestedAppVersion}; expected ${compatibility.compatibleAppVersions}.`
    );
  }

  const requestedSaveGameSchemaVersion = environment.saveGameSchemaVersion ?? saveGameSchemaVersion;
  if (
    requestedSaveGameSchemaVersion < compatibility.compatibleSaveGameSchemaVersions.min ||
    requestedSaveGameSchemaVersion > compatibility.compatibleSaveGameSchemaVersions.max
  ) {
    errors.push(
      `${moduleId} is not compatible with save-game schema ${requestedSaveGameSchemaVersion}.`
    );
  }

  const requestedDatastoreSchemaVersion =
    environment.datastoreSchemaVersion ?? datastoreSchemaVersion;
  if (
    requestedDatastoreSchemaVersion < compatibility.compatibleDatastoreSchemaVersions.min ||
    requestedDatastoreSchemaVersion > compatibility.compatibleDatastoreSchemaVersions.max
  ) {
    errors.push(
      `${moduleId} is not compatible with datastore schema ${requestedDatastoreSchemaVersion}.`
    );
  }

  const requestedModuleApiVersion = environment.moduleApiVersion || moduleApiVersion;
  if (
    !versionSatisfiesRange(requestedModuleApiVersion, compatibility.compatibleModuleApiVersions)
  ) {
    errors.push(
      `${moduleId} is not compatible with module API ${requestedModuleApiVersion}; expected ${compatibility.compatibleModuleApiVersions}.`
    );
  }

  return errors;
}

export function isModuleCompatibleWith(
  moduleId: string,
  moduleVersion: string,
  otherModuleId: string,
  otherModuleVersion: string,
  environment: Omit<ModuleCompatibilityEnvironment, "modules"> = {}
): boolean {
  const compatibility = moduleCompatibility.find((entry) => entry.moduleId === moduleId) || null;
  const otherCompatibility =
    moduleCompatibility.find((entry) => entry.moduleId === otherModuleId) || null;
  if (
    !compatibility ||
    !otherCompatibility ||
    !getFunctionalModuleVersion(moduleId) ||
    !getFunctionalModuleVersion(otherModuleId)
  ) {
    return false;
  }

  const errors = collectModuleCompatibilitySurfaceErrors(
    moduleId,
    moduleVersion,
    compatibility,
    environment
  );
  errors.push(
    ...collectModuleCompatibilitySurfaceErrors(
      otherModuleId,
      otherModuleVersion,
      otherCompatibility,
      environment
    )
  );
  const requirement = compatibility.requires.find((entry) => entry.moduleId === otherModuleId);
  if (requirement && !versionSatisfiesRange(otherModuleVersion, requirement.versions)) {
    errors.push(
      `${moduleId} requires ${requirement.moduleId} ${requirement.versions}, received ${otherModuleVersion}.`
    );
  }

  const reverseRequirement = otherCompatibility.requires.find(
    (entry) => entry.moduleId === moduleId
  );
  if (reverseRequirement && !versionSatisfiesRange(moduleVersion, reverseRequirement.versions)) {
    errors.push(
      `${otherModuleId} requires ${reverseRequirement.moduleId} ${reverseRequirement.versions}, received ${moduleVersion}.`
    );
  }

  return errors.length === 0;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function findModuleVersionChangeRequirements(
  changedPaths: readonly string[],
  changedModuleIds: readonly string[],
  modules: readonly FunctionalModuleVersion[] = functionalModuleVersions
): ModuleVersionChangeRequirement[] {
  const changedModuleIdSet = new Set(changedModuleIds);
  const normalizedChangedPaths = changedPaths.map(normalizeRepoPath);

  return modules
    .map((moduleEntry) => {
      const ownedChangedPaths = normalizedChangedPaths.filter((changedPath) =>
        moduleEntry.ownerPaths.some((ownerPath) => {
          const normalizedOwnerPath = normalizeRepoPath(ownerPath);
          return normalizedOwnerPath.endsWith("/")
            ? changedPath.startsWith(normalizedOwnerPath)
            : changedPath === normalizedOwnerPath;
        })
      );

      return {
        moduleId: moduleEntry.id,
        moduleName: moduleEntry.name,
        version: moduleEntry.version,
        changedPaths: ownedChangedPaths,
        versionChanged: changedModuleIdSet.has(moduleEntry.id)
      };
    })
    .filter((entry) => entry.changedPaths.length > 0);
}
