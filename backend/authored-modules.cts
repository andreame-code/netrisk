const {
  authoredModuleInputSchema,
  authoredModuleSchema
} = require("../shared/runtime-validation.cjs");
const { registeredMaps } = require("../shared/maps/index.cjs");
const { listVictoryRuleSets } = require("../shared/victory-rule-sets.cjs");

import type {
  AuthoredMapOption,
  AuthoredModule,
  AuthoredModuleInput,
  AuthoredModulePreview,
  AuthoredModuleRuntime,
  AuthoredModuleSummary,
  AuthoredModuleValidation,
  AuthoredModuleValidationIssue,
  AuthoredVictoryObjective,
  AdminAuthoredModuleDetailResponse,
  AdminAuthoredModuleEditorOptionsResponse,
  AdminAuthoredModuleValidateResponse
} from "../shared/runtime-validation.cjs";
import type { SupportedMap } from "../shared/maps/index.cjs";

type MapCatalog = {
  listMaps(): SupportedMap[];
  resolveMap(mapId: string): SupportedMap | null;
};

type AuthoredModulesOptions = {
  datastore: {
    getAppState?: (key: string) => unknown | Promise<unknown>;
    setAppState?: (key: string, value: unknown) => unknown | Promise<unknown>;
  };
};

type ServiceError = Error & {
  statusCode?: number;
  validation?: AuthoredModuleValidation;
};

const AUTHORED_MODULES_STATE_KEY = "authoredGameplayModules";
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function maybeResolve<T>(value: Promise<T> | T): Promise<T> {
  return Promise.resolve(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeString(value: unknown): string {
  return asString(value).trim();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function createServiceError(
  message: string,
  statusCode: number = 400,
  validation?: AuthoredModuleValidation
): ServiceError {
  const error = new Error(message) as ServiceError;
  error.statusCode = statusCode;
  if (validation) {
    error.validation = validation;
  }
  return error;
}

function issue(
  code: string,
  path: string,
  message: string,
  severity: "warning" | "error" = "error"
): AuthoredModuleValidationIssue {
  return {
    code,
    path,
    message,
    severity
  };
}

function defaultMapCatalog(): MapCatalog {
  return {
    listMaps() {
      return registeredMaps.map((entry: SupportedMap) => clone(entry));
    },
    resolveMap(mapId: string) {
      const match = registeredMaps.find((entry: SupportedMap) => entry.id === mapId) || null;
      return match ? clone(match) : null;
    }
  };
}

const builtInVictoryRuleSetIds = new Set(
  listVictoryRuleSets()
    .map((entry: { id?: unknown }) => normalizeString(entry?.id))
    .filter(isNonEmptyString)
);

function buildMapOption(map: SupportedMap): AuthoredMapOption {
  const territories = Array.isArray(map?.territories) ? map.territories : [];
  const continents = Array.isArray(map?.continents) ? map.continents : [];

  return {
    id: String(map?.id || ""),
    name: String(map?.name || ""),
    territoryCount: territories.length,
    continentCount: continents.length,
    continents: continents.map((continent) => ({
      id: String(continent?.id || ""),
      name: String(continent?.name || ""),
      bonus: Number(continent?.bonus || 0),
      territoryCount: Array.isArray(continent?.territoryIds) ? continent.territoryIds.length : 0
    }))
  };
}

function readableList(values: string[]): string {
  if (!values.length) {
    return "";
  }

  if (values.length === 1) {
    return values[0] as string;
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function objectiveSummary(objective: AuthoredVictoryObjective, map: SupportedMap | null): string {
  if (objective.type === "control-continents") {
    const continentNames = (objective.continentIds || [])
      .map((continentId) =>
        Array.isArray(map?.continents)
          ? map.continents.find((entry) => entry.id === continentId)?.name || continentId
          : continentId
      )
      .filter(isNonEmptyString);

    return continentNames.length
      ? `Control ${readableList(continentNames)} simultaneously.`
      : "Control the selected continents simultaneously.";
  }

  const territoryCount =
    typeof objective.territoryCount === "number" && Number.isInteger(objective.territoryCount)
      ? objective.territoryCount
      : null;

  return territoryCount
    ? `Own at least ${territoryCount} territories.`
    : "Own the configured minimum territory count.";
}

function moduleSummaryText(moduleEntry: AuthoredModule, map: SupportedMap | null): string {
  const enabledObjectives = (moduleEntry.content.objectives || []).filter(
    (objective) => objective.enabled
  );
  if (!enabledObjectives.length) {
    return "No enabled win conditions yet.";
  }

  if (enabledObjectives.length === 1) {
    return `Win condition: ${objectiveSummary(enabledObjectives[0] as AuthoredVictoryObjective, map)}`;
  }

  return `Win condition: complete any of the ${enabledObjectives.length} enabled objectives for ${moduleEntry.name || "this module"}.`;
}

function buildPreview(
  moduleEntry: AuthoredModule,
  map: SupportedMap | null
): AuthoredModulePreview {
  return {
    summary: moduleSummaryText(moduleEntry, map),
    objectiveSummaries: (moduleEntry.content.objectives || []).map((objective) =>
      objectiveSummary(objective as AuthoredVictoryObjective, map)
    )
  };
}

function buildRuntime(
  moduleEntry: AuthoredModule,
  map: SupportedMap | null
): AuthoredModuleRuntime {
  const mapOption = map ? buildMapOption(map) : null;

  return {
    id: moduleEntry.id,
    name: moduleEntry.name,
    description: moduleEntry.description,
    version: moduleEntry.version,
    moduleType: moduleEntry.moduleType,
    kind: "authored-victory-objectives",
    map: mapOption
      ? {
          id: mapOption.id,
          name: mapOption.name,
          territoryCount: mapOption.territoryCount,
          continentCount: mapOption.continentCount
        }
      : {
          id: normalizeString(moduleEntry.content.mapId),
          name: normalizeString(moduleEntry.content.mapId),
          territoryCount: 0,
          continentCount: 0
        },
    objectives: (moduleEntry.content.objectives || []).map((objective) => {
      if (objective.type === "control-continents") {
        const continentNames = (objective.continentIds || []).map((continentId) => {
          const name = Array.isArray(map?.continents)
            ? map.continents.find((entry) => entry.id === continentId)?.name
            : null;
          return name || continentId;
        });

        return {
          id: objective.id,
          title: objective.title,
          description: objective.description,
          enabled: objective.enabled,
          type: objective.type,
          continentIds: [...objective.continentIds],
          continentNames,
          summary: objectiveSummary(objective, map)
        };
      }

      return {
        id: objective.id,
        title: objective.title,
        description: objective.description,
        enabled: objective.enabled,
        type: objective.type,
        territoryCount:
          typeof objective.territoryCount === "number" && Number.isInteger(objective.territoryCount)
            ? objective.territoryCount
            : null,
        summary: objectiveSummary(objective, map)
      };
    }),
    preview: buildPreview(moduleEntry, map)
  };
}

function validateModule(
  moduleEntry: AuthoredModule,
  mapCatalog: MapCatalog
): {
  validation: AuthoredModuleValidation;
  preview: AuthoredModulePreview;
  runtime: AuthoredModuleRuntime;
  map: AuthoredMapOption | null;
  objectiveCount: number;
  enabledObjectiveCount: number;
} {
  const errors: AuthoredModuleValidationIssue[] = [];
  const warnings: AuthoredModuleValidationIssue[] = [];
  const moduleId = normalizeString(moduleEntry.id);
  const name = normalizeString(moduleEntry.name);
  const description = normalizeString(moduleEntry.description);
  const version = normalizeString(moduleEntry.version);
  const mapId = normalizeString(moduleEntry.content?.mapId);
  const map = mapId ? mapCatalog.resolveMap(mapId) : null;
  const mapOption = map ? buildMapOption(map) : null;
  const objectives = Array.isArray(moduleEntry.content?.objectives)
    ? moduleEntry.content.objectives
    : [];
  const enabledObjectiveCount = objectives.filter((objective) => objective?.enabled).length;
  const seenObjectiveIds = new Set<string>();
  const validContinentIds = new Set((mapOption?.continents || []).map((continent) => continent.id));

  if (!moduleId) {
    errors.push(issue("required-id", "id", "Module id is required."));
  } else if (!ID_PATTERN.test(moduleId)) {
    errors.push(
      issue(
        "invalid-id",
        "id",
        "Use letters, numbers, dashes, underscores, or dots for the module id."
      )
    );
  } else if (builtInVictoryRuleSetIds.has(moduleId)) {
    errors.push(
      issue(
        "reserved-module-id",
        "id",
        `Module id "${moduleId}" is already used by a built-in victory rule set.`
      )
    );
  }

  if (!name) {
    errors.push(issue("required-name", "name", "Module name is required."));
  }

  if (!description) {
    errors.push(issue("required-description", "description", "Module description is required."));
  }

  if (!version) {
    errors.push(issue("required-version", "version", "Module version is required."));
  }

  if (!mapId) {
    errors.push(
      issue("required-map", "content.mapId", "Select a target map for this objective module.")
    );
  } else if (!mapOption) {
    errors.push(
      issue(
        "invalid-map",
        "content.mapId",
        `Map "${mapId}" is not currently available in the runtime catalog.`
      )
    );
  }

  if (!objectives.length) {
    errors.push(
      issue(
        "required-objectives",
        "content.objectives",
        "Add at least one objective before publishing."
      )
    );
  }

  objectives.forEach((objective, index) => {
    const basePath = `content.objectives.${index}`;
    const objectiveId = normalizeString(objective?.id);
    const title = normalizeString(objective?.title);
    const objectiveDescription = normalizeString(objective?.description);

    if (!objectiveId) {
      errors.push(issue("required-objective-id", `${basePath}.id`, "Objective id is required."));
    } else if (!ID_PATTERN.test(objectiveId)) {
      errors.push(
        issue(
          "invalid-objective-id",
          `${basePath}.id`,
          "Use letters, numbers, dashes, underscores, or dots for the objective id."
        )
      );
    } else if (seenObjectiveIds.has(objectiveId)) {
      errors.push(
        issue(
          "duplicate-objective-id",
          `${basePath}.id`,
          `Objective id "${objectiveId}" is already used in this module.`
        )
      );
    } else {
      seenObjectiveIds.add(objectiveId);
    }

    if (!title) {
      errors.push(
        issue("required-objective-title", `${basePath}.title`, "Objective title is required.")
      );
    }

    if (!objectiveDescription) {
      errors.push(
        issue(
          "required-objective-description",
          `${basePath}.description`,
          "Objective description is required."
        )
      );
    }

    if (objective.type === "control-continents") {
      const continentIds = Array.isArray(objective.continentIds) ? objective.continentIds : [];
      if (!continentIds.length) {
        errors.push(
          issue(
            "required-continents",
            `${basePath}.continentIds`,
            "Select at least one continent for this objective."
          )
        );
      }

      const seenContinentIds = new Set<string>();
      continentIds.forEach((continentId, continentIndex) => {
        const normalizedContinentId = normalizeString(continentId);
        const continentPath = `${basePath}.continentIds.${continentIndex}`;
        if (!normalizedContinentId) {
          errors.push(issue("required-continent-id", continentPath, "Continent id is required."));
          return;
        }

        if (seenContinentIds.has(normalizedContinentId)) {
          errors.push(
            issue(
              "duplicate-continent-id",
              continentPath,
              `Continent "${normalizedContinentId}" is already selected for this objective.`
            )
          );
          return;
        }
        seenContinentIds.add(normalizedContinentId);

        if (mapOption && !validContinentIds.has(normalizedContinentId)) {
          errors.push(
            issue(
              "invalid-continent-id",
              continentPath,
              `Continent "${normalizedContinentId}" does not exist on ${mapOption.name}.`
            )
          );
        }
      });
    }

    if (objective.type === "control-territory-count") {
      const territoryCount = objective.territoryCount;
      if (!Number.isInteger(territoryCount) || Number(territoryCount) < 1) {
        errors.push(
          issue(
            "invalid-territory-count",
            `${basePath}.territoryCount`,
            "Territory objectives require a whole number greater than zero."
          )
        );
      } else if (mapOption && Number(territoryCount) > mapOption.territoryCount) {
        errors.push(
          issue(
            "territory-count-out-of-range",
            `${basePath}.territoryCount`,
            `Territory count cannot exceed ${mapOption.territoryCount} for ${mapOption.name}.`
          )
        );
      }
    }
  });

  if (objectives.length > 0 && enabledObjectiveCount === 0) {
    errors.push(
      issue(
        "no-enabled-objectives",
        "content.objectives",
        "Enable at least one objective before publishing this module."
      )
    );
  }

  return {
    validation: {
      valid: errors.length === 0,
      errors,
      warnings
    },
    preview: buildPreview(moduleEntry, map),
    runtime: buildRuntime(moduleEntry, map),
    map: mapOption,
    objectiveCount: objectives.length,
    enabledObjectiveCount
  };
}

function toDetailPayload(
  moduleEntry: AuthoredModule,
  mapCatalog: MapCatalog
): AdminAuthoredModuleDetailResponse {
  const { validation, preview, runtime } = validateModule(moduleEntry, mapCatalog);
  return {
    module: clone(moduleEntry),
    validation,
    preview,
    runtime
  };
}

function toSummaryPayload(
  moduleEntry: AuthoredModule,
  mapCatalog: MapCatalog
): AuthoredModuleSummary {
  const detail = validateModule(moduleEntry, mapCatalog);

  return {
    ...clone(moduleEntry),
    validation: detail.validation,
    preview: detail.preview,
    map: detail.map
      ? {
          id: detail.map.id,
          name: detail.map.name,
          territoryCount: detail.map.territoryCount,
          continentCount: detail.map.continentCount
        }
      : null,
    objectiveCount: detail.objectiveCount,
    enabledObjectiveCount: detail.enabledObjectiveCount
  };
}

function normalizeStoredModule(input: unknown): AuthoredModule | null {
  const parsed = authoredModuleSchema.safeParse(input);
  return parsed.success ? clone(parsed.data) : null;
}

function sortModules(modules: AuthoredModule[]): AuthoredModule[] {
  return modules.sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );
}

function createAuthoredModulesService(options: AuthoredModulesOptions) {
  let mapCatalog = defaultMapCatalog();

  async function readModules(): Promise<AuthoredModule[]> {
    if (typeof options.datastore.getAppState !== "function") {
      return [];
    }

    const raw = await maybeResolve(options.datastore.getAppState(AUTHORED_MODULES_STATE_KEY));
    const source = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as { modules?: unknown[] }).modules)
        ? (raw as { modules: unknown[] }).modules
        : [];

    return sortModules(
      source
        .map((entry) => normalizeStoredModule(entry))
        .filter((entry): entry is AuthoredModule => Boolean(entry))
    );
  }

  async function writeModules(modules: AuthoredModule[]): Promise<void> {
    if (typeof options.datastore.setAppState !== "function") {
      throw createServiceError("Datastore does not support authored module persistence.", 500);
    }

    await maybeResolve(
      options.datastore.setAppState(
        AUTHORED_MODULES_STATE_KEY,
        sortModules(modules.map((entry) => clone(entry)))
      )
    );
  }

  async function getModuleOrThrow(moduleId: string): Promise<AuthoredModule> {
    const modules = await readModules();
    const match = modules.find((entry) => entry.id === moduleId) || null;
    if (!match) {
      throw createServiceError(`Authored module "${moduleId}" was not found.`, 404);
    }

    return match;
  }

  function parseInput(input: unknown): AuthoredModuleInput {
    const parsed = authoredModuleInputSchema.safeParse(input);
    if (!parsed.success) {
      throw createServiceError("Authored module payload is not valid.", 400);
    }

    return clone(parsed.data);
  }

  async function validateDraft(input: unknown): Promise<AdminAuthoredModuleValidateResponse> {
    const parsed = parseInput(input);
    const moduleEntry: AuthoredModule = {
      ...parsed,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const detail = toDetailPayload(moduleEntry, mapCatalog);

    return {
      validation: detail.validation,
      preview: detail.preview,
      runtime: detail.runtime
    };
  }

  async function saveDraft(input: unknown): Promise<AdminAuthoredModuleDetailResponse> {
    const parsed = parseInput(input);
    const modules = await readModules();
    const existingIndex = modules.findIndex((entry) => entry.id === parsed.id);
    const now = new Date().toISOString();

    if (existingIndex >= 0 && modules[existingIndex]?.status !== "draft") {
      throw createServiceError(
        "Only draft modules are editable in this phase. Create a new draft to change published content.",
        409
      );
    }

    const nextEntry: AuthoredModule = {
      ...clone(existingIndex >= 0 ? modules[existingIndex] : null),
      ...parsed,
      status: "draft",
      createdAt: existingIndex >= 0 ? modules[existingIndex].createdAt : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      modules[existingIndex] = nextEntry;
    } else {
      modules.push(nextEntry);
    }

    await writeModules(modules);
    return toDetailPayload(nextEntry, mapCatalog);
  }

  async function publishModule(moduleId: string): Promise<AdminAuthoredModuleDetailResponse> {
    const modules = await readModules();
    const index = modules.findIndex((entry) => entry.id === moduleId);
    if (index < 0) {
      throw createServiceError(`Authored module "${moduleId}" was not found.`, 404);
    }

    const detail = toDetailPayload(modules[index] as AuthoredModule, mapCatalog);
    if (!detail.validation.valid) {
      throw createServiceError(
        "This module still has validation errors and cannot be published.",
        400,
        detail.validation
      );
    }

    modules[index] = {
      ...clone(modules[index] as AuthoredModule),
      status: "published",
      updatedAt: new Date().toISOString()
    };
    await writeModules(modules);
    return toDetailPayload(modules[index] as AuthoredModule, mapCatalog);
  }

  async function disableModule(moduleId: string): Promise<AdminAuthoredModuleDetailResponse> {
    const modules = await readModules();
    const index = modules.findIndex((entry) => entry.id === moduleId);
    if (index < 0) {
      throw createServiceError(`Authored module "${moduleId}" was not found.`, 404);
    }

    modules[index] = {
      ...clone(modules[index] as AuthoredModule),
      status: "disabled",
      updatedAt: new Date().toISOString()
    };
    await writeModules(modules);
    return toDetailPayload(modules[index] as AuthoredModule, mapCatalog);
  }

  async function enableModule(moduleId: string): Promise<AdminAuthoredModuleDetailResponse> {
    const modules = await readModules();
    const index = modules.findIndex((entry) => entry.id === moduleId);
    if (index < 0) {
      throw createServiceError(`Authored module "${moduleId}" was not found.`, 404);
    }

    const detail = toDetailPayload(modules[index] as AuthoredModule, mapCatalog);
    if (!detail.validation.valid) {
      throw createServiceError(
        "This module no longer validates cleanly and cannot be enabled.",
        400,
        detail.validation
      );
    }

    modules[index] = {
      ...clone(modules[index] as AuthoredModule),
      status: "published",
      updatedAt: new Date().toISOString()
    };
    await writeModules(modules);
    return toDetailPayload(modules[index] as AuthoredModule, mapCatalog);
  }

  return {
    stateKey: AUTHORED_MODULES_STATE_KEY,
    setMapCatalog(nextCatalog: Partial<MapCatalog>) {
      mapCatalog = {
        listMaps:
          typeof nextCatalog.listMaps === "function" ? nextCatalog.listMaps : mapCatalog.listMaps,
        resolveMap:
          typeof nextCatalog.resolveMap === "function"
            ? nextCatalog.resolveMap
            : mapCatalog.resolveMap
      };
    },
    async listEditorOptions(): Promise<AdminAuthoredModuleEditorOptionsResponse> {
      return {
        moduleTypes: ["victory-objectives"],
        maps: mapCatalog
          .listMaps()
          .map((entry) => buildMapOption(entry))
          .sort((left, right) => left.name.localeCompare(right.name))
      };
    },
    async listModules(): Promise<AuthoredModuleSummary[]> {
      const modules = await readModules();
      return modules.map((moduleEntry) => toSummaryPayload(moduleEntry, mapCatalog));
    },
    async getModule(moduleId: string): Promise<AdminAuthoredModuleDetailResponse> {
      return toDetailPayload(await getModuleOrThrow(moduleId), mapCatalog);
    },
    async validateDraft(input: unknown) {
      return validateDraft(input);
    },
    async saveDraft(input: unknown) {
      return saveDraft(input);
    },
    async publishModule(moduleId: string) {
      return publishModule(moduleId);
    },
    async disableModule(moduleId: string) {
      return disableModule(moduleId);
    },
    async enableModule(moduleId: string) {
      return enableModule(moduleId);
    },
    async listPublishedVictoryRuleSets() {
      const modules = await readModules();
      return modules
        .filter((moduleEntry) => moduleEntry.status === "published")
        .map((moduleEntry) => ({
          moduleEntry,
          detail: toDetailPayload(moduleEntry, mapCatalog)
        }))
        .filter((entry) => entry.detail.validation.valid)
        .map(({ moduleEntry, detail }) => ({
          id: moduleEntry.id,
          name: moduleEntry.name,
          description: moduleEntry.description,
          source: "authored" as const,
          mapId: normalizeString(moduleEntry.content.mapId) || null,
          objectiveCount: moduleEntry.content.objectives.filter((objective) => objective.enabled)
            .length,
          moduleType: moduleEntry.moduleType,
          runtime: detail.runtime
        }));
    },
    async findPublishedVictoryRuleSetRuntime(
      moduleId: string
    ): Promise<AuthoredModuleRuntime | null> {
      const modules = await readModules();
      const moduleEntry = modules.find(
        (entry) => entry.id === moduleId && entry.status === "published"
      );
      if (!moduleEntry) {
        return null;
      }

      const detail = toDetailPayload(moduleEntry, mapCatalog);
      return detail.validation.valid ? detail.runtime : null;
    },
    async isModuleStored(moduleId: string): Promise<boolean> {
      const modules = await readModules();
      return modules.some((entry) => entry.id === moduleId);
    }
  };
}

module.exports = {
  AUTHORED_MODULES_STATE_KEY,
  createAuthoredModulesService
};
