const fs = require("fs");
const path = require("path");
const {
  CORE_MODULE_ID,
  CORE_MODULE_VERSION,
  NETRISK_ENGINE_VERSION,
  coreModuleReference,
  isEngineVersionCompatible,
  normalizeNetRiskGameModuleSelection,
  validateNetRiskModuleClientManifest,
  validateNetRiskModuleManifest
} = require("../shared/netrisk-modules.cjs");

import type {
  NetRiskGameModuleSelection,
  NetRiskInstalledModule,
  NetRiskModuleClientManifest,
  NetRiskModuleManifest,
  NetRiskModuleProfile,
  NetRiskModuleReference,
  NetRiskUiSlotContribution
} from "../shared/netrisk-modules.cjs";

type CatalogState = {
  enabledById: Record<string, boolean>;
  updatedAt: string | null;
};

type ModuleRuntimeOptions = {
  projectRoot: string;
  datastore: {
    getAppState?: (key: string) => unknown | Promise<unknown>;
    setAppState?: (key: string, value: unknown) => unknown | Promise<unknown>;
    listGames?: () => Array<Record<string, unknown>> | Promise<Array<Record<string, unknown>>>;
  };
};

type ModuleOptionsSnapshot = {
  modules: NetRiskInstalledModule[];
  enabledModules: NetRiskModuleReference[];
  gameModules: NetRiskInstalledModule[];
  uiSlots: NetRiskUiSlotContribution[];
  contentProfiles: NetRiskModuleProfile[];
  gameplayProfiles: NetRiskModuleProfile[];
  uiProfiles: NetRiskModuleProfile[];
};

const MODULE_CATALOG_STATE_KEY = "moduleCatalogState";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toModuleProfileArray(
  profiles: NetRiskModuleProfile[] | null | undefined,
  moduleId: string
): NetRiskModuleProfile[] {
  if (!Array.isArray(profiles)) {
    return [];
  }

  return profiles.map((profile) => ({
    ...profile,
    moduleId: profile.moduleId || moduleId
  }));
}

function cloneInstalledModule(moduleEntry: NetRiskInstalledModule): NetRiskInstalledModule {
  return {
    ...moduleEntry,
    manifest: moduleEntry.manifest
      ? {
          ...moduleEntry.manifest,
          dependencies: moduleEntry.manifest.dependencies.map((dependency) => ({ ...dependency })),
          conflicts: [...moduleEntry.manifest.conflicts],
          capabilities: moduleEntry.manifest.capabilities.map((capability) => ({ ...capability })),
          entrypoints: moduleEntry.manifest.entrypoints ? { ...moduleEntry.manifest.entrypoints } : null,
          migrations: [...(moduleEntry.manifest.migrations || [])],
          permissions: [...(moduleEntry.manifest.permissions || [])]
        }
      : null,
    capabilities: moduleEntry.capabilities.map((capability) => ({ ...capability })),
    warnings: [...moduleEntry.warnings],
    errors: [...moduleEntry.errors],
    clientManifestPath: moduleEntry.clientManifestPath || null,
    clientManifest: moduleEntry.clientManifest
      ? {
          ...moduleEntry.clientManifest,
          ui: moduleEntry.clientManifest.ui
            ? {
                ...moduleEntry.clientManifest.ui,
                slots: moduleEntry.clientManifest.ui.slots.map((slot) => ({ ...slot })),
                themeTokens: [...(moduleEntry.clientManifest.ui.themeTokens || [])],
                stylesheets: [...(moduleEntry.clientManifest.ui.stylesheets || [])],
                locales: [...(moduleEntry.clientManifest.ui.locales || [])]
              }
            : null,
          gameplay: moduleEntry.clientManifest.gameplay
            ? {
                hooks: [...(moduleEntry.clientManifest.gameplay.hooks || [])],
                profileIds: [...(moduleEntry.clientManifest.gameplay.profileIds || [])]
              }
            : null,
          content: moduleEntry.clientManifest.content
            ? {
                ...moduleEntry.clientManifest.content,
                mapIds: [...(moduleEntry.clientManifest.content.mapIds || [])],
                siteThemeIds: [...(moduleEntry.clientManifest.content.siteThemeIds || [])],
                pieceSkinIds: [...(moduleEntry.clientManifest.content.pieceSkinIds || [])],
                playerPieceSetIds: [...(moduleEntry.clientManifest.content.playerPieceSetIds || [])],
                contentPackIds: [...(moduleEntry.clientManifest.content.contentPackIds || [])],
                diceRuleSetIds: [...(moduleEntry.clientManifest.content.diceRuleSetIds || [])],
                cardRuleSetIds: [...(moduleEntry.clientManifest.content.cardRuleSetIds || [])],
                victoryRuleSetIds: [...(moduleEntry.clientManifest.content.victoryRuleSetIds || [])],
                fortifyRuleSetIds: [...(moduleEntry.clientManifest.content.fortifyRuleSetIds || [])],
                reinforcementRuleSetIds: [...(moduleEntry.clientManifest.content.reinforcementRuleSetIds || [])]
              }
            : null,
          profiles: moduleEntry.clientManifest.profiles
            ? {
                content: toModuleProfileArray(moduleEntry.clientManifest.profiles.content, moduleEntry.id),
                gameplay: toModuleProfileArray(moduleEntry.clientManifest.profiles.gameplay, moduleEntry.id),
                ui: toModuleProfileArray(moduleEntry.clientManifest.profiles.ui, moduleEntry.id)
              }
            : null
        }
      : null
  };
}

function defaultCoreManifest(): NetRiskModuleManifest {
  return {
    schemaVersion: 1,
    id: CORE_MODULE_ID,
    version: CORE_MODULE_VERSION,
    displayName: "NetRisk Core Base",
    description: "Built-in core module that exposes the default NetRisk gameplay, content and UI foundations.",
    engineVersion: NETRISK_ENGINE_VERSION,
    kind: "hybrid",
    dependencies: [],
    conflicts: [],
    capabilities: [
      { kind: "map", scope: "game", description: "Built-in official maps." },
      { kind: "site-theme", scope: "global", description: "Built-in site themes." },
      { kind: "player-piece-set", scope: "game", description: "Built-in player piece sets." },
      { kind: "dice-rule-set", scope: "game", description: "Built-in dice rulesets." },
      { kind: "card-rule-set", scope: "game", description: "Built-in card rulesets." },
      { kind: "victory-rule-set", scope: "game", description: "Built-in victory rulesets." },
      { kind: "ui-slot", scope: "global", description: "Built-in host UI slots." }
    ],
    entrypoints: {
      clientManifest: "client-manifest.json"
    },
    assetsDir: null,
    migrations: [],
    permissions: []
  };
}

function defaultCoreClientManifest(): NetRiskModuleClientManifest {
  return {
    ui: {
      slots: [
        {
          slotId: "top-nav-bar",
          itemId: "core-base-status",
          title: "Core command shell",
          kind: "badge",
          order: 0,
          description: "Built-in shell badge slot."
        },
        {
          slotId: "admin-modules-page",
          itemId: "core-base-modules-overview",
          title: "Modules overview",
          kind: "admin-card",
          order: 0,
          description: "Built-in admin slot for module management."
        }
      ],
      themeTokens: [],
      stylesheets: [],
      locales: []
    },
    profiles: {
      content: [
        {
          id: "core.classic-content",
          name: "Classic Content",
          description: "Default official content profile."
        }
      ],
      gameplay: [
        {
          id: "core.standard-gameplay",
          name: "Standard Gameplay",
          description: "Default official gameplay profile."
        }
      ],
      ui: [
        {
          id: "core.command-ui",
          name: "Command UI",
          description: "Default official command UI profile."
        }
      ]
    }
  };
}

function normalizeCatalogState(raw: unknown): CatalogState {
  if (!isObject(raw) || !isObject(raw.enabledById)) {
    return {
      enabledById: {
        [CORE_MODULE_ID]: true
      },
      updatedAt: null
    };
  }

  const enabledById = Object.entries(raw.enabledById).reduce<Record<string, boolean>>((accumulator, [moduleId, enabled]) => {
    if (isNonEmptyString(moduleId)) {
      accumulator[moduleId] = Boolean(enabled);
    }
    return accumulator;
  }, {
    [CORE_MODULE_ID]: true
  });

  return {
    enabledById,
    updatedAt: isNonEmptyString(raw.updatedAt) ? String(raw.updatedAt) : null
  };
}

function safeReadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadClientManifest(moduleRoot: string, manifest: NetRiskModuleManifest): {
  clientManifest: NetRiskModuleClientManifest | null;
  clientManifestPath: string | null;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const relativeClientManifestPath = manifest.entrypoints?.clientManifest || "client-manifest.json";
  const absoluteClientManifestPath = path.join(moduleRoot, relativeClientManifestPath);

  if (!fs.existsSync(absoluteClientManifestPath)) {
    if (manifest.entrypoints?.clientManifest) {
      warnings.push(`Client manifest not found: ${relativeClientManifestPath}.`);
    }

    return {
      clientManifest: null,
      clientManifestPath: null,
      warnings,
      errors
    };
  }

  try {
    return {
      clientManifest: validateNetRiskModuleClientManifest(safeReadJson(absoluteClientManifestPath), absoluteClientManifestPath),
      clientManifestPath: absoluteClientManifestPath,
      warnings,
      errors
    };
  } catch (error: unknown) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      clientManifest: null,
      clientManifestPath: absoluteClientManifestPath,
      warnings,
      errors
    };
  }
}

function baseInstalledModuleFromManifest(
  manifest: NetRiskModuleManifest,
  sourcePath: string,
  enabledById: Record<string, boolean>,
  clientManifest: NetRiskModuleClientManifest | null,
  clientManifestPath: string | null,
  warnings: string[],
  errors: string[]
): NetRiskInstalledModule {
  const isCoreModule = manifest.id === CORE_MODULE_ID;
  return {
    id: manifest.id,
    version: manifest.version,
    displayName: manifest.displayName,
    description: manifest.description || null,
    kind: manifest.kind,
    sourcePath,
    status: isCoreModule || enabledById[manifest.id] ? "enabled" : "validated",
    enabled: isCoreModule || Boolean(enabledById[manifest.id]),
    compatible: true,
    manifest,
    capabilities: manifest.capabilities.map((capability) => ({ ...capability })),
    warnings: [...warnings],
    errors: [...errors],
    clientManifestPath,
    clientManifest
  };
}

function summarizeProfiles(modules: NetRiskInstalledModule[], profileKind: "content" | "gameplay" | "ui"): NetRiskModuleProfile[] {
  return modules.flatMap((moduleEntry) => {
    const profileGroup = moduleEntry.clientManifest?.profiles?.[profileKind];
    return toModuleProfileArray(profileGroup, moduleEntry.id);
  });
}

function enabledReferences(modules: NetRiskInstalledModule[]): NetRiskModuleReference[] {
  return modules
    .filter((moduleEntry) => moduleEntry.enabled && moduleEntry.compatible && isNonEmptyString(moduleEntry.version))
    .map((moduleEntry) => ({
      id: moduleEntry.id,
      version: moduleEntry.version as string
    }));
}

function activeGameUsesModule(moduleId: string, games: Array<Record<string, unknown>>): boolean {
  return games.some((game) => {
    const state = isObject(game.state) ? game.state : null;
    if (!state || state.phase === "finished") {
      return false;
    }

    const gameConfig = isObject(state.gameConfig) ? state.gameConfig : null;
    const activeModules = Array.isArray(gameConfig?.activeModules) ? gameConfig?.activeModules : [];
    return activeModules.some((entry) => isObject(entry) && entry.id === moduleId);
  });
}

function buildModuleOptions(modules: NetRiskInstalledModule[]): ModuleOptionsSnapshot {
  const clonedModules = modules.map(cloneInstalledModule);
  const enabled = clonedModules.filter((moduleEntry) => moduleEntry.enabled && moduleEntry.compatible);
  return {
    modules: clonedModules,
    enabledModules: enabledReferences(clonedModules),
    gameModules: enabled
      .filter((moduleEntry) => moduleEntry.kind !== "ui")
      .map(cloneInstalledModule),
    uiSlots: enabled
      .flatMap((moduleEntry) => moduleEntry.clientManifest?.ui?.slots || [])
      .sort((left, right) => (left.order || 0) - (right.order || 0))
      .map((slot) => ({ ...slot })),
    contentProfiles: summarizeProfiles(enabled, "content"),
    gameplayProfiles: summarizeProfiles(enabled, "gameplay"),
    uiProfiles: summarizeProfiles(enabled, "ui")
  };
}

function createModuleRuntime(options: ModuleRuntimeOptions) {
  const modulesRoot = path.join(options.projectRoot, "modules");
  let cachedModules: NetRiskInstalledModule[] = [];
  let cachedState: CatalogState | null = null;

  async function loadCatalogState(): Promise<CatalogState> {
    if (cachedState) {
      return cachedState;
    }

    const rawState = typeof options.datastore.getAppState === "function"
      ? await options.datastore.getAppState(MODULE_CATALOG_STATE_KEY)
      : null;
    cachedState = normalizeCatalogState(rawState);
    return cachedState;
  }

  async function saveCatalogState(nextState: CatalogState): Promise<void> {
    cachedState = nextState;
    if (typeof options.datastore.setAppState === "function") {
      await options.datastore.setAppState(MODULE_CATALOG_STATE_KEY, nextState);
    }
  }

  function scanFilesystemModules(enabledById: Record<string, boolean>): NetRiskInstalledModule[] {
    const discoveredModules: NetRiskInstalledModule[] = [];
    const moduleDirectories = fs.existsSync(modulesRoot)
      ? fs.readdirSync(modulesRoot, { withFileTypes: true }).filter((entry: { isDirectory: () => boolean; }) => entry.isDirectory())
      : [];

    moduleDirectories.forEach((directory: { name: string; }) => {
      const moduleRoot = path.join(modulesRoot, directory.name);
      const manifestPath = path.join(moduleRoot, "module.json");
      if (!fs.existsSync(manifestPath)) {
        return;
      }

      try {
        const manifest = validateNetRiskModuleManifest(safeReadJson(manifestPath), manifestPath);
        const clientManifestResult = loadClientManifest(moduleRoot, manifest);
        const moduleEntry = baseInstalledModuleFromManifest(
          manifest,
          moduleRoot,
          enabledById,
          clientManifestResult.clientManifest,
          clientManifestResult.clientManifestPath,
          clientManifestResult.warnings,
          clientManifestResult.errors
        );
        if (clientManifestResult.errors.length) {
          moduleEntry.compatible = false;
          moduleEntry.status = "error";
        }
        discoveredModules.push(moduleEntry);
      } catch (error: unknown) {
        discoveredModules.push({
          id: directory.name,
          version: null,
          displayName: directory.name,
          description: null,
          kind: null,
          sourcePath: moduleRoot,
          status: "error",
          enabled: false,
          compatible: false,
          manifest: null,
          capabilities: [],
          warnings: [],
          errors: [error instanceof Error ? error.message : String(error)],
          clientManifestPath: null,
          clientManifest: null
        });
      }
    });

    return discoveredModules;
  }

  async function buildCatalog(): Promise<NetRiskInstalledModule[]> {
    const catalogState = await loadCatalogState();
    const coreManifestPath = path.join(modulesRoot, CORE_MODULE_ID, "module.json");
    let coreManifest = defaultCoreManifest();
    let coreWarnings: string[] = [];
    let coreErrors: string[] = [];
    let coreClientManifest = defaultCoreClientManifest();
    let coreClientManifestPath: string | null = null;

    if (fs.existsSync(coreManifestPath)) {
      try {
        coreManifest = validateNetRiskModuleManifest(safeReadJson(coreManifestPath), coreManifestPath);
      } catch (error: unknown) {
        coreErrors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const coreModuleRoot = path.join(modulesRoot, CORE_MODULE_ID);
    if (fs.existsSync(coreModuleRoot)) {
      const clientManifestResult = loadClientManifest(coreModuleRoot, coreManifest);
      if (clientManifestResult.clientManifest) {
        coreClientManifest = clientManifestResult.clientManifest;
      }
      coreWarnings = coreWarnings.concat(clientManifestResult.warnings);
      coreErrors = coreErrors.concat(clientManifestResult.errors);
      coreClientManifestPath = clientManifestResult.clientManifestPath;
    }

    const filesystemModules = scanFilesystemModules(catalogState.enabledById).filter((moduleEntry) => moduleEntry.id !== CORE_MODULE_ID);
    const modules = [
      baseInstalledModuleFromManifest(
        coreManifest,
        coreManifestPath,
        { ...catalogState.enabledById, [CORE_MODULE_ID]: true },
        coreClientManifest,
        coreClientManifestPath,
        coreWarnings,
        coreErrors
      ),
      ...filesystemModules
    ];

    const manifestModules = modules.filter((moduleEntry) => moduleEntry.manifest);
    const discoveredIds = new Set(manifestModules.map((moduleEntry) => moduleEntry.id));

    manifestModules.forEach((moduleEntry) => {
      const manifest = moduleEntry.manifest as NetRiskModuleManifest;
      if (!isEngineVersionCompatible(NETRISK_ENGINE_VERSION, manifest.engineVersion)) {
        moduleEntry.compatible = false;
        moduleEntry.errors.push(`Engine version mismatch: requires ${manifest.engineVersion}, current engine is ${NETRISK_ENGINE_VERSION}.`);
      }

      manifest.dependencies.forEach((dependency) => {
        if (!discoveredIds.has(dependency.id) && !dependency.optional) {
          moduleEntry.compatible = false;
          moduleEntry.errors.push(`Missing dependency "${dependency.id}".`);
        }
      });
    });

    const enabledIds = new Set(
      modules
        .filter((moduleEntry) => moduleEntry.enabled)
        .map((moduleEntry) => moduleEntry.id)
    );
    enabledIds.add(CORE_MODULE_ID);

    manifestModules.forEach((moduleEntry) => {
      const manifest = moduleEntry.manifest as NetRiskModuleManifest;
      if (moduleEntry.enabled) {
        const blockingDependency = manifest.dependencies.find((dependency) =>
          !dependency.optional && !enabledIds.has(dependency.id)
        );
        if (blockingDependency) {
          moduleEntry.compatible = false;
          moduleEntry.errors.push(`Dependency "${blockingDependency.id}" must be enabled first.`);
        }

        const conflictingModuleId = manifest.conflicts.find((conflictId) => enabledIds.has(conflictId));
        if (conflictingModuleId) {
          moduleEntry.compatible = false;
          moduleEntry.errors.push(`Conflicts with enabled module "${conflictingModuleId}".`);
        }
      }

      if (!moduleEntry.errors.length && moduleEntry.enabled) {
        moduleEntry.status = "enabled";
      } else if (!moduleEntry.errors.length && !moduleEntry.enabled) {
        moduleEntry.status = catalogState.enabledById[moduleEntry.id] === false ? "disabled" : "validated";
      } else if (moduleEntry.errors.length) {
        moduleEntry.status = moduleEntry.manifest ? "incompatible" : "error";
      }
    });

    cachedModules = modules.map(cloneInstalledModule);
    return cachedModules.map(cloneInstalledModule);
  }

  async function ensureCatalog(): Promise<NetRiskInstalledModule[]> {
    if (cachedModules.length) {
      return cachedModules.map(cloneInstalledModule);
    }

    return buildCatalog();
  }

  async function listGames(): Promise<Array<Record<string, unknown>>> {
    if (typeof options.datastore.listGames !== "function") {
      return [];
    }

    const games = await options.datastore.listGames();
    return Array.isArray(games) ? games : [];
  }

  async function getModuleOptions() {
    return buildModuleOptions(await ensureCatalog());
  }

  return {
    async rescan() {
      cachedModules = [];
      return ensureCatalog();
    },
    async listInstalledModules() {
      return ensureCatalog();
    },
    async getModuleOptions() {
      return getModuleOptions();
    },
    async getEnabledModules() {
      return enabledReferences(await ensureCatalog());
    },
    async enableModule(moduleId: string) {
      const installedModules = await ensureCatalog();
      const target = installedModules.find((moduleEntry) => moduleEntry.id === moduleId);
      if (!target || !target.manifest) {
        throw new Error(`Module "${moduleId}" not found.`);
      }

      if (target.id === CORE_MODULE_ID) {
        return installedModules;
      }

      if (!target.compatible) {
        throw new Error(`Module "${moduleId}" is not compatible: ${target.errors.join(" ")}`.trim());
      }

      const catalogState = await loadCatalogState();
      const nextState: CatalogState = {
        enabledById: {
          ...catalogState.enabledById,
          [moduleId]: true,
          [CORE_MODULE_ID]: true
        },
        updatedAt: new Date().toISOString()
      };

      await saveCatalogState(nextState);
      cachedModules = [];
      return ensureCatalog();
    },
    async disableModule(moduleId: string) {
      if (moduleId === CORE_MODULE_ID) {
        throw new Error("Core module cannot be disabled.");
      }

      const installedModules = await ensureCatalog();
      const target = installedModules.find((moduleEntry) => moduleEntry.id === moduleId);
      if (!target || !target.manifest) {
        throw new Error(`Module "${moduleId}" not found.`);
      }

      const games = await listGames();
      if (activeGameUsesModule(moduleId, games)) {
        throw new Error(`Module "${moduleId}" is still referenced by an active game.`);
      }

      const catalogState = await loadCatalogState();
      const nextState: CatalogState = {
        enabledById: {
          ...catalogState.enabledById,
          [moduleId]: false,
          [CORE_MODULE_ID]: true
        },
        updatedAt: new Date().toISOString()
      };

      await saveCatalogState(nextState);
      cachedModules = [];
      return ensureCatalog();
    },
    async resolveGameSelection(input: {
      activeModuleIds?: string[];
      contentProfileId?: string | null;
      gameplayProfileId?: string | null;
      uiProfileId?: string | null;
    } = {}): Promise<NetRiskGameModuleSelection> {
      const optionsSnapshot = await getModuleOptions();
      const requestedIds = Array.isArray(input.activeModuleIds)
        ? Array.from(new Set(input.activeModuleIds.filter((value) => isNonEmptyString(value))))
        : [];
      const selectedModules = requestedIds.map((moduleId) => {
        const match = optionsSnapshot.gameModules.find((moduleEntry) => moduleEntry.id === moduleId);
        if (!match || !match.version) {
          throw new Error(`Game module "${moduleId}" is not available.`);
        }
        return {
          id: match.id,
          version: match.version
        };
      });

      const availableContentProfiles = new Set(optionsSnapshot.contentProfiles.map((profile) => profile.id));
      const availableGameplayProfiles = new Set(optionsSnapshot.gameplayProfiles.map((profile) => profile.id));
      const availableUiProfiles = new Set(optionsSnapshot.uiProfiles.map((profile) => profile.id));

      if (input.contentProfileId && !availableContentProfiles.has(input.contentProfileId)) {
        throw new Error(`Unknown content profile "${input.contentProfileId}".`);
      }

      if (input.gameplayProfileId && !availableGameplayProfiles.has(input.gameplayProfileId)) {
        throw new Error(`Unknown gameplay profile "${input.gameplayProfileId}".`);
      }

      if (input.uiProfileId && !availableUiProfiles.has(input.uiProfileId)) {
        throw new Error(`Unknown UI profile "${input.uiProfileId}".`);
      }

      return normalizeNetRiskGameModuleSelection({
        activeModules: [coreModuleReference(), ...selectedModules],
        contentProfileId: input.contentProfileId || null,
        gameplayProfileId: input.gameplayProfileId || null,
        uiProfileId: input.uiProfileId || null
      });
    }
  };
}

module.exports = {
  createModuleRuntime
};
