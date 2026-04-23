const fs = require("fs");
const path = require("path");
const { listCardRuleSets } = require("../shared/cards.cjs");
const {
  findCoreBaseSupportedMap,
  listCoreBaseMapSummaries,
  listCoreBaseNewGameRuleSets
} = require("../shared/core-base-catalog.cjs");
const {
  findContentPack: findBuiltInContentPack,
  listContentPacks
} = require("../shared/content-packs.cjs");
const { findDiceRuleSet: findBuiltInDiceRuleSet, listDiceRuleSets } = require("../shared/dice.cjs");
const { listFortifyRuleSets } = require("../shared/fortify-rule-sets.cjs");
const { summarizeMap } = require("../shared/maps/index.cjs");
const {
  findPlayerPieceSet: findBuiltInPlayerPieceSet,
  listPlayerPieceSets
} = require("../shared/player-piece-sets.cjs");
const { listReinforcementRuleSets } = require("../shared/reinforcement-rule-sets.cjs");
const { listSiteThemes } = require("../shared/site-themes.cjs");
const { buildContinentDefinition, buildMapDefinition } = require("../shared/typed-map-data.cjs");
const {
  findVictoryRuleSet: findBuiltInVictoryRuleSet,
  listPieceSkins,
  listVictoryRuleSets,
  listVisualThemes
} = require("../shared/extensions.cjs");
const {
  CORE_MODULE_ID,
  CORE_MODULE_VERSION,
  NETRISK_ENGINE_VERSION,
  coreModuleReference,
  isEngineVersionCompatible,
  normalizeNetRiskGameModuleSelection,
  validateNetRiskServerModule,
  validateNetRiskModuleClientManifest,
  validateNetRiskModuleManifest
} = require("../shared/netrisk-modules.cjs");

import type {
  NetRiskGameplayEffects,
  NetRiskModuleConfigDefaults,
  NetRiskModuleContentPackDefinition,
  NetRiskContentContribution,
  NetRiskGamePreset,
  NetRiskGameModuleSelection,
  NetRiskInstalledModule,
  NetRiskModuleMapDefinition,
  NetRiskModuleClientManifest,
  NetRiskModuleManifest,
  NetRiskModuleDiceRuleSetDefinition,
  NetRiskModuleProfile,
  NetRiskModulePlayerPieceSetDefinition,
  NetRiskModuleReference,
  NetRiskResolvedModuleCatalog,
  NetRiskResolvedGamePreset,
  NetRiskResolvedModuleSetup,
  NetRiskScenarioSetup,
  NetRiskServerModule
} from "../shared/netrisk-modules.cjs";
import type { ContentPackSummary } from "../shared/content-packs.cjs";
import type { DiceRuleSet, DiceRuleSetSummary } from "../shared/dice.cjs";
import type {
  BuiltInNewGameRuleSetSummary,
  PieceSkin,
  VictoryRuleSet,
  VisualTheme
} from "../shared/extensions.cjs";
import type { MapSummary, SupportedMap } from "../shared/maps/index.cjs";
import type { PlayerPieceSet, PlayerPieceSetSummary } from "../shared/player-piece-sets.cjs";
import type { AuthoredVictoryModuleRuntime } from "../shared/runtime-validation.cjs";

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
  authoredModules?: {
    listPublishedVictoryRuleSets?: () =>
      | AuthoredPublishedVictoryRuleSet[]
      | Promise<AuthoredPublishedVictoryRuleSet[]>;
  };
};

type ModuleOptionsSnapshot = NetRiskResolvedModuleCatalog & {
  resolvedCatalog: NetRiskResolvedModuleCatalog;
};

type RuntimeModuleMapEntry = {
  moduleId: string;
  map: SupportedMap;
};

type RuntimeModuleContentPackEntry = {
  moduleId: string;
  contentPack: ContentPackSummary;
};

type RuntimeModulePlayerPieceSetEntry = {
  moduleId: string;
  pieceSet: PlayerPieceSet;
};

type RuntimeModuleDiceRuleSetEntry = {
  moduleId: string;
  diceRuleSet: DiceRuleSet;
};

type AuthoredPublishedVictoryRuleSet = {
  id: string;
  name: string;
  description: string;
  source: "authored";
  mapId?: string | null;
  objectiveCount?: number;
  moduleType?: string | null;
  runtime: AuthoredVictoryModuleRuntime;
};

const MODULE_CATALOG_STATE_KEY = "moduleCatalogState";
const CONTENT_CONTRIBUTION_KEYS = [
  "mapIds",
  "siteThemeIds",
  "pieceSkinIds",
  "playerPieceSetIds",
  "contentPackIds",
  "diceRuleSetIds",
  "cardRuleSetIds",
  "victoryRuleSetIds",
  "fortifyRuleSetIds",
  "reinforcementRuleSetIds"
] as const;

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

function toGamePresetArray(
  presets: NetRiskGamePreset[] | null | undefined,
  moduleId: string
): NetRiskGamePreset[] {
  if (!Array.isArray(presets)) {
    return [];
  }

  return presets.map((preset) => ({
    ...preset,
    moduleId: preset.moduleId || moduleId,
    activeModuleIds: Array.isArray(preset.activeModuleIds) ? [...preset.activeModuleIds] : [],
    defaults: preset.defaults ? { ...preset.defaults } : null
  }));
}

function emptyContentContribution(): NetRiskContentContribution {
  return {
    mapIds: [],
    siteThemeIds: [],
    pieceSkinIds: [],
    playerPieceSetIds: [],
    contentPackIds: [],
    diceRuleSetIds: [],
    cardRuleSetIds: [],
    victoryRuleSetIds: [],
    fortifyRuleSetIds: [],
    reinforcementRuleSetIds: []
  };
}

function cloneMapSummary(summary: MapSummary): MapSummary {
  return {
    ...summary,
    continentBonuses: Array.isArray(summary.continentBonuses)
      ? summary.continentBonuses.map((continent) => ({ ...continent }))
      : []
  };
}

function cloneContentPackSummary(contentPack: ContentPackSummary): ContentPackSummary {
  return {
    ...contentPack
  };
}

function clonePlayerPieceSetSummary(pieceSet: PlayerPieceSetSummary): PlayerPieceSetSummary {
  return {
    ...pieceSet
  };
}

function clonePlayerPieceSet(pieceSet: PlayerPieceSet): PlayerPieceSet {
  return {
    ...pieceSet,
    palette: Array.isArray(pieceSet.palette) ? [...pieceSet.palette] : []
  };
}

function cloneDiceRuleSetSummary(ruleSet: DiceRuleSetSummary): DiceRuleSetSummary {
  return {
    ...ruleSet
  };
}

function cloneDiceRuleSet(ruleSet: DiceRuleSet): DiceRuleSet {
  return {
    ...ruleSet
  };
}

function cloneVictoryRuleSet(ruleSet: VictoryRuleSet): VictoryRuleSet {
  return {
    ...ruleSet
  };
}

function cloneAuthoredVictoryRuntime(
  runtime: AuthoredVictoryModuleRuntime
): AuthoredVictoryModuleRuntime {
  return JSON.parse(JSON.stringify(runtime ?? null)) as AuthoredVictoryModuleRuntime;
}

function cloneRuleSetSummary(ruleSet: BuiltInNewGameRuleSetSummary): BuiltInNewGameRuleSetSummary {
  return {
    id: ruleSet.id,
    name: ruleSet.name,
    defaults: {
      ...ruleSet.defaults
    }
  };
}

function cloneVisualTheme(theme: VisualTheme): VisualTheme {
  return {
    ...theme
  };
}

function clonePieceSkin(pieceSkin: PieceSkin): PieceSkin {
  return {
    ...pieceSkin
  };
}

function cloneSupportedMap(map: SupportedMap): SupportedMap {
  return {
    ...map,
    territories: Array.isArray(map.territories)
      ? map.territories.map((territory) => ({
          ...territory,
          neighbors: Array.isArray(territory.neighbors) ? [...territory.neighbors] : []
        }))
      : [],
    positions: isObject(map.positions)
      ? Object.entries(map.positions).reduce<Record<string, { x: number; y: number }>>(
          (accumulator, [territoryId, position]) => {
            if (
              isObject(position) &&
              typeof position.x === "number" &&
              typeof position.y === "number"
            ) {
              accumulator[territoryId] = { x: position.x, y: position.y };
            }
            return accumulator;
          },
          {}
        )
      : {},
    continents: Array.isArray(map.continents)
      ? map.continents.map((continent) => ({
          ...continent,
          territoryIds: Array.isArray(continent.territoryIds) ? [...continent.territoryIds] : []
        }))
      : [],
    mapDefinition: isObject(map.mapDefinition)
      ? {
          ...map.mapDefinition,
          territories: Array.isArray(map.mapDefinition.territories)
            ? map.mapDefinition.territories.map((entry) => ({
                territory: {
                  ...entry.territory,
                  neighbors: Array.isArray(entry.territory.neighbors)
                    ? [...entry.territory.neighbors]
                    : []
                },
                position: { ...entry.position }
              }))
            : [],
          positions: isObject(map.mapDefinition.positions)
            ? Object.entries(map.mapDefinition.positions).reduce<
                Record<string, { x: number; y: number }>
              >((accumulator, [territoryId, position]) => {
                if (
                  isObject(position) &&
                  typeof position.x === "number" &&
                  typeof position.y === "number"
                ) {
                  accumulator[territoryId] = { x: position.x, y: position.y };
                }
                return accumulator;
              }, {})
            : {},
          continents: Array.isArray(map.mapDefinition.continents)
            ? map.mapDefinition.continents.map((continent) => ({
                ...continent,
                territoryIds: Array.isArray(continent.territoryIds)
                  ? [...continent.territoryIds]
                  : []
              }))
            : []
        }
      : map.mapDefinition
  };
}

function aggregateContentContribution(
  modules: NetRiskInstalledModule[],
  runtimeMapEntries: RuntimeModuleMapEntry[] = [],
  runtimeContentPackEntries: RuntimeModuleContentPackEntry[] = [],
  runtimePlayerPieceSetEntries: RuntimeModulePlayerPieceSetEntry[] = [],
  runtimeDiceRuleSetEntries: RuntimeModuleDiceRuleSetEntry[] = []
): NetRiskContentContribution {
  const contribution = emptyContentContribution();

  modules.forEach((moduleEntry) => {
    const content = moduleEntry.clientManifest?.content;
    if (!content) {
      return;
    }

    CONTENT_CONTRIBUTION_KEYS.forEach((key) => {
      const currentValues = contribution[key] || [];
      const nextValues = Array.isArray(content[key]) ? content[key] : [];
      contribution[key] = Array.from(new Set([...currentValues, ...nextValues]));
    });
  });

  if (runtimeMapEntries.length) {
    contribution.mapIds = Array.from(
      new Set([...(contribution.mapIds || []), ...runtimeMapEntries.map((entry) => entry.map.id)])
    );
  }

  if (runtimeContentPackEntries.length) {
    contribution.contentPackIds = Array.from(
      new Set([
        ...(contribution.contentPackIds || []),
        ...runtimeContentPackEntries.map((entry) => entry.contentPack.id)
      ])
    );
  }

  if (runtimePlayerPieceSetEntries.length) {
    contribution.playerPieceSetIds = Array.from(
      new Set([
        ...(contribution.playerPieceSetIds || []),
        ...runtimePlayerPieceSetEntries.map((entry) => entry.pieceSet.id)
      ])
    );
  }

  if (runtimeDiceRuleSetEntries.length) {
    contribution.diceRuleSetIds = Array.from(
      new Set([
        ...(contribution.diceRuleSetIds || []),
        ...runtimeDiceRuleSetEntries.map((entry) => entry.diceRuleSet.id)
      ])
    );
  }

  return contribution;
}

function moduleEntriesForSelection(
  modules: NetRiskInstalledModule[],
  moduleIds: string[]
): NetRiskInstalledModule[] {
  const requestedIds = new Set([CORE_MODULE_ID, ...moduleIds]);
  return modules.filter((moduleEntry) => requestedIds.has(moduleEntry.id));
}

function ensureAllowedContentId(
  kind: string,
  requestedId: string | null | undefined,
  availableIds: string[] | null | undefined
): void {
  if (!isNonEmptyString(requestedId) || !Array.isArray(availableIds) || !availableIds.length) {
    return;
  }

  if (!availableIds.includes(requestedId)) {
    throw new Error(`Selected ${kind} "${requestedId}" is not exposed by the active modules.`);
  }
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
          entrypoints: moduleEntry.manifest.entrypoints
            ? { ...moduleEntry.manifest.entrypoints }
            : null,
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
                playerPieceSetIds: [
                  ...(moduleEntry.clientManifest.content.playerPieceSetIds || [])
                ],
                contentPackIds: [...(moduleEntry.clientManifest.content.contentPackIds || [])],
                diceRuleSetIds: [...(moduleEntry.clientManifest.content.diceRuleSetIds || [])],
                cardRuleSetIds: [...(moduleEntry.clientManifest.content.cardRuleSetIds || [])],
                victoryRuleSetIds: [
                  ...(moduleEntry.clientManifest.content.victoryRuleSetIds || [])
                ],
                fortifyRuleSetIds: [
                  ...(moduleEntry.clientManifest.content.fortifyRuleSetIds || [])
                ],
                reinforcementRuleSetIds: [
                  ...(moduleEntry.clientManifest.content.reinforcementRuleSetIds || [])
                ]
              }
            : null,
          gamePresets: toGamePresetArray(moduleEntry.clientManifest.gamePresets, moduleEntry.id),
          profiles: moduleEntry.clientManifest.profiles
            ? {
                content: toModuleProfileArray(
                  moduleEntry.clientManifest.profiles.content,
                  moduleEntry.id
                ),
                gameplay: toModuleProfileArray(
                  moduleEntry.clientManifest.profiles.gameplay,
                  moduleEntry.id
                ),
                ui: toModuleProfileArray(moduleEntry.clientManifest.profiles.ui, moduleEntry.id)
              }
            : null
        }
      : null
  };
}

function buildRuntimeModuleMap(
  moduleId: string,
  mapDefinition: NetRiskModuleMapDefinition,
  sourcePath: string
): SupportedMap {
  const mapSource = `${sourcePath}#${mapDefinition.id}`;
  const resolvedMapDefinition = buildMapDefinition(mapSource, mapDefinition.territoryRecords);
  const continentDefinition = buildContinentDefinition(mapSource, mapDefinition.continentRecords, {
    validTerritoryIds: resolvedMapDefinition.territories
      .map((entry: { territory: { id?: string | null } }) => entry.territory.id)
      .filter((territoryId: unknown): territoryId is string => isNonEmptyString(territoryId))
  });

  return {
    id: mapDefinition.id,
    name: mapDefinition.name,
    territories: resolvedMapDefinition.territories.map(
      (entry: { territory: SupportedMap["territories"][number] }) => entry.territory
    ),
    positions: resolvedMapDefinition.positions,
    continents: continentDefinition.continents,
    mapDefinition: {
      ...resolvedMapDefinition,
      continents: continentDefinition.continents
    }
  };
}

function buildRuntimeModuleContentPack(
  contentPackDefinition: NetRiskModuleContentPackDefinition
): ContentPackSummary {
  return {
    id: contentPackDefinition.id,
    name: contentPackDefinition.name,
    description: contentPackDefinition.description,
    defaultSiteThemeId: contentPackDefinition.defaultSiteThemeId,
    defaultMapId: contentPackDefinition.defaultMapId,
    defaultDiceRuleSetId: contentPackDefinition.defaultDiceRuleSetId,
    defaultCardRuleSetId: contentPackDefinition.defaultCardRuleSetId,
    defaultVictoryRuleSetId: contentPackDefinition.defaultVictoryRuleSetId,
    defaultPieceSetId: contentPackDefinition.defaultPieceSetId
  };
}

function buildRuntimeModulePlayerPieceSet(
  pieceSetDefinition: NetRiskModulePlayerPieceSetDefinition
): PlayerPieceSet {
  return {
    id: pieceSetDefinition.id,
    name: pieceSetDefinition.name,
    palette: [...pieceSetDefinition.palette]
  };
}

function buildRuntimeModuleDiceRuleSet(
  ruleSetDefinition: NetRiskModuleDiceRuleSetDefinition
): DiceRuleSet {
  return {
    id: ruleSetDefinition.id,
    name: ruleSetDefinition.name,
    attackerMaxDice: ruleSetDefinition.attackerMaxDice,
    defenderMaxDice: ruleSetDefinition.defenderMaxDice,
    attackerMustLeaveOneArmyBehind: ruleSetDefinition.attackerMustLeaveOneArmyBehind,
    defenderWinsTies: ruleSetDefinition.defenderWinsTies
  };
}

function defaultCoreManifest(): NetRiskModuleManifest {
  return {
    schemaVersion: 1,
    id: CORE_MODULE_ID,
    version: CORE_MODULE_VERSION,
    displayName: "NetRisk Core Base",
    description:
      "Built-in core module that exposes the default NetRisk gameplay, content and UI foundations.",
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
    content: {
      mapIds: listCoreBaseMapSummaries().map((map: { id: string }) => map.id),
      siteThemeIds: listSiteThemes().map((theme: { id: string }) => theme.id),
      pieceSkinIds: listPieceSkins().map((skin: { id: string }) => skin.id),
      playerPieceSetIds: listPlayerPieceSets().map((pieceSet: { id: string }) => pieceSet.id),
      contentPackIds: listContentPacks().map((pack: { id: string }) => pack.id),
      diceRuleSetIds: listDiceRuleSets().map((ruleSet: { id: string }) => ruleSet.id),
      cardRuleSetIds: listCardRuleSets().map((ruleSet: { id: string }) => ruleSet.id),
      victoryRuleSetIds: listVictoryRuleSets().map((ruleSet: { id: string }) => ruleSet.id),
      fortifyRuleSetIds: listFortifyRuleSets().map((ruleSet: { id: string }) => ruleSet.id),
      reinforcementRuleSetIds: listReinforcementRuleSets().map(
        (ruleSet: { id: string }) => ruleSet.id
      )
    },
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
    gamePresets: [
      {
        id: "core.base.standard",
        name: "Classic Core",
        description: "Preset ufficiale base con profili core e setup classico.",
        moduleId: CORE_MODULE_ID,
        activeModuleIds: [],
        contentProfileId: "core.classic-content",
        gameplayProfileId: "core.standard-gameplay",
        uiProfileId: "core.command-ui",
        defaults: {
          contentPackId: "core",
          ruleSetId: "classic",
          mapId: "classic-mini",
          diceRuleSetId: "standard",
          victoryRuleSetId: "conquest",
          themeId: "command",
          pieceSkinId: "classic-color"
        }
      }
    ],
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

  const enabledById = Object.entries(raw.enabledById).reduce<Record<string, boolean>>(
    (accumulator, [moduleId, enabled]) => {
      if (isNonEmptyString(moduleId)) {
        accumulator[moduleId] = Boolean(enabled);
      }
      return accumulator;
    },
    {
      [CORE_MODULE_ID]: true
    }
  );

  return {
    enabledById,
    updatedAt: isNonEmptyString(raw.updatedAt) ? String(raw.updatedAt) : null
  };
}

function safeReadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveCompiledServerEntrypointPath(
  projectRoot: string,
  absoluteSourcePath: string
): string | null {
  const relativePath = path.relative(projectRoot, absoluteSourcePath);
  if (!relativePath || relativePath.startsWith("..")) {
    return null;
  }

  if (absoluteSourcePath.endsWith(".cts")) {
    return path.join(projectRoot, ".tsbuild", relativePath.replace(/\.cts$/i, ".cjs"));
  }

  if (absoluteSourcePath.endsWith(".ts")) {
    return path.join(projectRoot, ".tsbuild", relativePath.replace(/\.ts$/i, ".js"));
  }

  return null;
}

function loadServerModule(
  moduleRoot: string,
  manifest: NetRiskModuleManifest,
  projectRoot: string
): {
  serverModule: NetRiskServerModule | null;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const relativeServerPath = manifest.entrypoints?.server;

  if (!relativeServerPath) {
    return {
      serverModule: null,
      warnings,
      errors
    };
  }

  const absoluteSourcePath = path.resolve(moduleRoot, relativeServerPath);
  if (absoluteSourcePath !== moduleRoot && !absoluteSourcePath.startsWith(moduleRoot + path.sep)) {
    errors.push(`Server entrypoint "${relativeServerPath}" escapes the module directory.`);
    return {
      serverModule: null,
      warnings,
      errors
    };
  }

  let requirePath = absoluteSourcePath;
  if (absoluteSourcePath.endsWith(".cts") || absoluteSourcePath.endsWith(".ts")) {
    const compiledPath = resolveCompiledServerEntrypointPath(projectRoot, absoluteSourcePath);
    if (!compiledPath || !fs.existsSync(compiledPath)) {
      errors.push(`Compiled server entrypoint not found for "${relativeServerPath}".`);
      return {
        serverModule: null,
        warnings,
        errors
      };
    }

    requirePath = compiledPath;
  } else if (!fs.existsSync(requirePath)) {
    errors.push(`Server entrypoint not found: ${relativeServerPath}.`);
    return {
      serverModule: null,
      warnings,
      errors
    };
  }

  try {
    delete require.cache[require.resolve(requirePath)];
    const requiredModule = require(requirePath);
    const exported =
      requiredModule && requiredModule.default ? requiredModule.default : requiredModule;
    return {
      serverModule: validateNetRiskServerModule(exported, requirePath),
      warnings,
      errors
    };
  } catch (error: unknown) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      serverModule: null,
      warnings,
      errors
    };
  }
}

function loadClientManifest(
  moduleRoot: string,
  manifest: NetRiskModuleManifest
): {
  clientManifest: NetRiskModuleClientManifest | null;
  clientManifestPath: string | null;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const relativeClientManifestPath = manifest.entrypoints?.clientManifest || "client-manifest.json";
  const absoluteClientManifestPath = path.resolve(moduleRoot, relativeClientManifestPath);

  if (
    absoluteClientManifestPath !== moduleRoot &&
    !absoluteClientManifestPath.startsWith(moduleRoot + path.sep)
  ) {
    errors.push(`Client manifest "${relativeClientManifestPath}" escapes the module directory.`);
    return {
      clientManifest: null,
      clientManifestPath: null,
      warnings,
      errors
    };
  }

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
      clientManifest: validateNetRiskModuleClientManifest(
        safeReadJson(absoluteClientManifestPath),
        absoluteClientManifestPath
      ),
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

function summarizeProfiles(
  modules: NetRiskInstalledModule[],
  profileKind: "content" | "gameplay" | "ui"
): NetRiskModuleProfile[] {
  return modules.flatMap((moduleEntry) => {
    const profileGroup = moduleEntry.clientManifest?.profiles?.[profileKind];
    return toModuleProfileArray(profileGroup, moduleEntry.id);
  });
}

function summarizeGamePresets(modules: NetRiskInstalledModule[]): NetRiskGamePreset[] {
  return modules.flatMap((moduleEntry) =>
    toGamePresetArray(moduleEntry.clientManifest?.gamePresets, moduleEntry.id)
  );
}

function enabledReferences(modules: NetRiskInstalledModule[]): NetRiskModuleReference[] {
  return modules
    .filter(
      (moduleEntry) =>
        moduleEntry.enabled && moduleEntry.compatible && isNonEmptyString(moduleEntry.version)
    )
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

function filterMapsByAllowedIds(
  entries: MapSummary[],
  allowedIds: string[] | null | undefined
): MapSummary[] {
  if (!Array.isArray(allowedIds) || !allowedIds.length) {
    return entries.map(cloneMapSummary);
  }

  const allowedIdSet = new Set(allowedIds);
  return entries.filter((entry) => allowedIdSet.has(entry.id)).map(cloneMapSummary);
}

function filterContentPacksByAllowedIds(
  entries: ContentPackSummary[],
  allowedIds: string[] | null | undefined
): ContentPackSummary[] {
  if (!Array.isArray(allowedIds) || !allowedIds.length) {
    return entries.map(cloneContentPackSummary);
  }

  const allowedIdSet = new Set(allowedIds);
  return entries.filter((entry) => allowedIdSet.has(entry.id)).map(cloneContentPackSummary);
}

function filterPlayerPieceSetsByAllowedIds(
  entries: PlayerPieceSetSummary[],
  allowedIds: string[] | null | undefined
): PlayerPieceSetSummary[] {
  if (!Array.isArray(allowedIds) || !allowedIds.length) {
    return entries.map(clonePlayerPieceSetSummary);
  }

  const allowedIdSet = new Set(allowedIds);
  return entries.filter((entry) => allowedIdSet.has(entry.id)).map(clonePlayerPieceSetSummary);
}

function filterDiceRuleSetsByAllowedIds(
  entries: DiceRuleSetSummary[],
  allowedIds: string[] | null | undefined
): DiceRuleSetSummary[] {
  if (!Array.isArray(allowedIds) || !allowedIds.length) {
    return entries.map(cloneDiceRuleSetSummary);
  }

  const allowedIdSet = new Set(allowedIds);
  return entries.filter((entry) => allowedIdSet.has(entry.id)).map(cloneDiceRuleSetSummary);
}

function filterVictoryRuleSetsByAllowedIds(
  entries: VictoryRuleSet[],
  allowedIds: string[] | null | undefined
): VictoryRuleSet[] {
  if (!Array.isArray(allowedIds) || !allowedIds.length) {
    return entries.map(cloneVictoryRuleSet);
  }

  const allowedIdSet = new Set(allowedIds);
  return entries.filter((entry) => allowedIdSet.has(entry.id)).map(cloneVictoryRuleSet);
}

function filterRuleSetsByAllowedContent(
  entries: BuiltInNewGameRuleSetSummary[],
  _content: NetRiskContentContribution
): BuiltInNewGameRuleSetSummary[] {
  // Rule sets are setup presets/default bundles, not capability lists. Content filtering already
  // happens on maps, dice, victory rules, themes, and piece skins individually, so pruning
  // rule sets by their defaults can hide valid configurations that explicitly override them.
  return entries.map(cloneRuleSetSummary);
}

function filterThemesByAllowedIds(
  entries: VisualTheme[],
  allowedIds: string[] | null | undefined
): VisualTheme[] {
  if (!Array.isArray(allowedIds) || !allowedIds.length) {
    return entries.map(cloneVisualTheme);
  }

  const allowedIdSet = new Set(allowedIds);
  return entries.filter((entry) => allowedIdSet.has(entry.id)).map(cloneVisualTheme);
}

function filterPieceSkinsByAllowedIds(
  entries: PieceSkin[],
  allowedIds: string[] | null | undefined
): PieceSkin[] {
  if (!Array.isArray(allowedIds) || !allowedIds.length) {
    return entries.map(clonePieceSkin);
  }

  const allowedIdSet = new Set(allowedIds);
  return entries.filter((entry) => allowedIdSet.has(entry.id)).map(clonePieceSkin);
}

function buildResolvedModuleCatalog(
  modules: NetRiskInstalledModule[],
  runtimeMapEntries: RuntimeModuleMapEntry[],
  runtimeContentPackEntries: RuntimeModuleContentPackEntry[],
  runtimePlayerPieceSetEntries: RuntimeModulePlayerPieceSetEntry[],
  runtimeDiceRuleSetEntries: RuntimeModuleDiceRuleSetEntry[],
  authoredVictoryRuleSets: AuthoredPublishedVictoryRuleSet[] = []
): NetRiskResolvedModuleCatalog {
  const clonedModules = modules.map(cloneInstalledModule);
  const enabled = clonedModules.filter(
    (moduleEntry) => moduleEntry.enabled && moduleEntry.compatible
  );
  const enabledRuntimeMapEntries = runtimeMapEntries.filter((entry) =>
    enabled.some((moduleEntry) => moduleEntry.id === entry.moduleId)
  );
  const enabledRuntimeContentPackEntries = runtimeContentPackEntries.filter((entry) =>
    enabled.some((moduleEntry) => moduleEntry.id === entry.moduleId)
  );
  const enabledRuntimePlayerPieceSetEntries = runtimePlayerPieceSetEntries.filter((entry) =>
    enabled.some((moduleEntry) => moduleEntry.id === entry.moduleId)
  );
  const enabledRuntimeDiceRuleSetEntries = runtimeDiceRuleSetEntries.filter((entry) =>
    enabled.some((moduleEntry) => moduleEntry.id === entry.moduleId)
  );
  const content = aggregateContentContribution(
    enabled,
    enabledRuntimeMapEntries,
    enabledRuntimeContentPackEntries,
    enabledRuntimePlayerPieceSetEntries,
    enabledRuntimeDiceRuleSetEntries
  );
  const authoredVictoryRuleSetIds = authoredVictoryRuleSets.map((entry) => entry.id);

  if (authoredVictoryRuleSetIds.length) {
    content.victoryRuleSetIds = Array.from(
      new Set([...(content.victoryRuleSetIds || []), ...authoredVictoryRuleSetIds])
    );
  }

  return {
    modules: clonedModules,
    enabledModules: enabledReferences(clonedModules),
    gameModules: enabled
      .filter((moduleEntry) => moduleEntry.kind !== "ui")
      .map(cloneInstalledModule),
    content,
    maps: filterMapsByAllowedIds(
      [
        ...listCoreBaseMapSummaries().map(cloneMapSummary),
        ...enabledRuntimeMapEntries.map((entry) => summarizeMap(entry.map)).map(cloneMapSummary)
      ],
      content.mapIds
    ),
    ruleSets: filterRuleSetsByAllowedContent(listCoreBaseNewGameRuleSets(), content),
    playerPieceSets: filterPlayerPieceSetsByAllowedIds(
      [
        ...listPlayerPieceSets().map(clonePlayerPieceSetSummary),
        ...enabledRuntimePlayerPieceSetEntries
          .map((entry) => ({
            id: entry.pieceSet.id,
            name: entry.pieceSet.name,
            paletteSize: entry.pieceSet.palette.length
          }))
          .map(clonePlayerPieceSetSummary)
      ],
      content.playerPieceSetIds
    ),
    diceRuleSets: filterDiceRuleSetsByAllowedIds(
      [
        ...listDiceRuleSets().map(cloneDiceRuleSetSummary),
        ...enabledRuntimeDiceRuleSetEntries
          .map((entry) => ({
            id: entry.diceRuleSet.id,
            name: entry.diceRuleSet.name,
            attackerMaxDice: entry.diceRuleSet.attackerMaxDice,
            defenderMaxDice: entry.diceRuleSet.defenderMaxDice
          }))
          .map(cloneDiceRuleSetSummary)
      ],
      content.diceRuleSetIds
    ),
    contentPacks: filterContentPacksByAllowedIds(
      [
        ...listContentPacks().map(cloneContentPackSummary),
        ...enabledRuntimeContentPackEntries.map((entry) =>
          cloneContentPackSummary(entry.contentPack)
        )
      ],
      content.contentPackIds
    ),
    victoryRuleSets: filterVictoryRuleSetsByAllowedIds(
      [
        ...listVictoryRuleSets().map(cloneVictoryRuleSet),
        ...authoredVictoryRuleSets.map((entry) =>
          cloneVictoryRuleSet({
            id: entry.id,
            name: entry.name,
            description: entry.description,
            source: entry.source,
            mapId: entry.mapId || null,
            objectiveCount:
              typeof entry.objectiveCount === "number" ? entry.objectiveCount : undefined,
            moduleType: entry.moduleType || null
          })
        )
      ],
      content.victoryRuleSetIds
    ),
    themes: filterThemesByAllowedIds(
      listVisualThemes().map(cloneVisualTheme),
      content.siteThemeIds
    ),
    pieceSkins: filterPieceSkinsByAllowedIds(
      listPieceSkins().map(clonePieceSkin),
      content.pieceSkinIds
    ),
    gamePresets: summarizeGamePresets(enabled),
    uiSlots: enabled
      .flatMap((moduleEntry) => moduleEntry.clientManifest?.ui?.slots || [])
      .sort((left, right) => (left.order || 0) - (right.order || 0))
      .map((slot) => ({ ...slot })),
    contentProfiles: summarizeProfiles(enabled, "content"),
    gameplayProfiles: summarizeProfiles(enabled, "gameplay"),
    uiProfiles: summarizeProfiles(enabled, "ui")
  };
}

function buildModuleOptions(
  modules: NetRiskInstalledModule[],
  runtimeMapEntries: RuntimeModuleMapEntry[],
  runtimeContentPackEntries: RuntimeModuleContentPackEntry[],
  runtimePlayerPieceSetEntries: RuntimeModulePlayerPieceSetEntry[],
  runtimeDiceRuleSetEntries: RuntimeModuleDiceRuleSetEntry[],
  authoredVictoryRuleSets: AuthoredPublishedVictoryRuleSet[] = []
): ModuleOptionsSnapshot {
  const resolvedCatalog = buildResolvedModuleCatalog(
    modules,
    runtimeMapEntries,
    runtimeContentPackEntries,
    runtimePlayerPieceSetEntries,
    runtimeDiceRuleSetEntries,
    authoredVictoryRuleSets
  );

  return {
    ...resolvedCatalog,
    resolvedCatalog
  };
}

function mergeConfigDefaults(
  target: NetRiskModuleConfigDefaults,
  defaults: NetRiskModuleConfigDefaults | null | undefined
): NetRiskModuleConfigDefaults {
  if (!defaults) {
    return target;
  }

  const next = { ...target };
  (
    [
      "contentPackId",
      "ruleSetId",
      "pieceSetId",
      "mapId",
      "diceRuleSetId",
      "victoryRuleSetId",
      "themeId",
      "pieceSkinId"
    ] as const
  ).forEach((key) => {
    if (!isNonEmptyString(next[key]) && isNonEmptyString(defaults[key])) {
      next[key] = defaults[key];
    }
  });

  return next;
}

function mergeScenarioSetup(
  target: NetRiskScenarioSetup,
  scenarioSetup: NetRiskScenarioSetup | null | undefined
): NetRiskScenarioSetup {
  if (!scenarioSetup) {
    return target;
  }

  const nextBonuses = new Map<string, number>();
  (target.territoryBonuses || []).forEach((entry) => {
    nextBonuses.set(entry.territoryId, (nextBonuses.get(entry.territoryId) || 0) + entry.armies);
  });
  (scenarioSetup.territoryBonuses || []).forEach((entry) => {
    nextBonuses.set(entry.territoryId, (nextBonuses.get(entry.territoryId) || 0) + entry.armies);
  });

  return {
    territoryBonuses: Array.from(nextBonuses.entries()).map(([territoryId, armies]) => ({
      territoryId,
      armies
    })),
    logMessage: target.logMessage || scenarioSetup.logMessage || null
  };
}

function mergeGameplayEffects(
  target: NetRiskGameplayEffects,
  gameplayEffects: NetRiskGameplayEffects | null | undefined
): NetRiskGameplayEffects {
  if (!gameplayEffects) {
    return target;
  }

  return {
    reinforcementAdjustments: [
      ...(Array.isArray(target.reinforcementAdjustments)
        ? target.reinforcementAdjustments.map((entry) => ({ ...entry }))
        : []),
      ...(Array.isArray(gameplayEffects.reinforcementAdjustments)
        ? gameplayEffects.reinforcementAdjustments.map((entry) => ({ ...entry }))
        : [])
    ],
    majorityControlThresholdPercent:
      typeof gameplayEffects.majorityControlThresholdPercent === "number"
        ? gameplayEffects.majorityControlThresholdPercent
        : typeof target.majorityControlThresholdPercent === "number"
          ? target.majorityControlThresholdPercent
          : null,
    conquestMinimumArmies:
      typeof gameplayEffects.conquestMinimumArmies === "number"
        ? gameplayEffects.conquestMinimumArmies
        : typeof target.conquestMinimumArmies === "number"
          ? target.conquestMinimumArmies
          : null,
    fortifyMinimumArmies:
      typeof gameplayEffects.fortifyMinimumArmies === "number"
        ? gameplayEffects.fortifyMinimumArmies
        : typeof target.fortifyMinimumArmies === "number"
          ? target.fortifyMinimumArmies
          : null,
    requiredFortifyWhenAvailable:
      typeof gameplayEffects.requiredFortifyWhenAvailable === "boolean"
        ? gameplayEffects.requiredFortifyWhenAvailable
        : typeof target.requiredFortifyWhenAvailable === "boolean"
          ? target.requiredFortifyWhenAvailable
          : null,
    attackMinimumArmies:
      typeof gameplayEffects.attackMinimumArmies === "number"
        ? gameplayEffects.attackMinimumArmies
        : typeof target.attackMinimumArmies === "number"
          ? target.attackMinimumArmies
          : null,
    attackLimitPerTurn:
      typeof gameplayEffects.attackLimitPerTurn === "number"
        ? gameplayEffects.attackLimitPerTurn
        : typeof target.attackLimitPerTurn === "number"
          ? target.attackLimitPerTurn
          : null,
    minimumAttacksPerTurn:
      typeof gameplayEffects.minimumAttacksPerTurn === "number"
        ? gameplayEffects.minimumAttacksPerTurn
        : typeof target.minimumAttacksPerTurn === "number"
          ? target.minimumAttacksPerTurn
          : null
  };
}

function createModuleRuntime(options: ModuleRuntimeOptions) {
  const modulesRoot = path.join(options.projectRoot, "modules");
  let cachedModules: NetRiskInstalledModule[] = [];
  let cachedState: CatalogState | null = null;
  let serverModulesById = new Map<string, NetRiskServerModule>();
  let runtimeMapsById = new Map<string, RuntimeModuleMapEntry>();
  let runtimeContentPacksById = new Map<string, RuntimeModuleContentPackEntry>();
  let runtimePlayerPieceSetsById = new Map<string, RuntimeModulePlayerPieceSetEntry>();
  let runtimeDiceRuleSetsById = new Map<string, RuntimeModuleDiceRuleSetEntry>();
  let authoredVictoryRuleSets: AuthoredPublishedVictoryRuleSet[] = [];
  let authoredVictoryRuleSetRuntimesById = new Map<string, AuthoredVictoryModuleRuntime>();

  function registerServerModuleMaps(
    moduleId: string,
    serverModule: NetRiskServerModule,
    sourcePath: string
  ): string[] {
    if (!Array.isArray(serverModule.maps) || !serverModule.maps.length) {
      return [];
    }

    const errors: string[] = [];
    serverModule.maps.forEach((moduleMap) => {
      try {
        if (findCoreBaseSupportedMap(moduleMap.id)) {
          errors.push(`Module map "${moduleMap.id}" conflicts with a built-in map.`);
          return;
        }

        const existing = runtimeMapsById.get(moduleMap.id);
        if (existing && existing.moduleId !== moduleId) {
          errors.push(`Module map "${moduleMap.id}" conflicts with module "${existing.moduleId}".`);
          return;
        }

        runtimeMapsById.set(moduleMap.id, {
          moduleId,
          map: buildRuntimeModuleMap(moduleId, moduleMap, sourcePath)
        });
      } catch (error: unknown) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    });

    return errors;
  }

  function registerServerModuleContentPacks(
    moduleId: string,
    serverModule: NetRiskServerModule,
    sourcePath: string
  ): string[] {
    if (!Array.isArray(serverModule.contentPacks) || !serverModule.contentPacks.length) {
      return [];
    }

    const errors: string[] = [];
    const knownMapIds = new Set([
      ...listCoreBaseMapSummaries().map((entry: { id: string }) => entry.id),
      ...Array.from(runtimeMapsById.keys())
    ]);
    const knownThemeIds = new Set(listSiteThemes().map((entry: { id: string }) => entry.id));
    const knownPieceSetIds = new Set([
      ...listPlayerPieceSets().map((entry: { id: string }) => entry.id),
      ...Array.from(runtimePlayerPieceSetsById.keys())
    ]);
    const knownDiceRuleSetIds = new Set([
      ...listDiceRuleSets().map((entry: { id: string }) => entry.id),
      ...Array.from(runtimeDiceRuleSetsById.keys())
    ]);
    const knownCardRuleSetIds = new Set(
      listCardRuleSets().map((entry: { id: string }) => entry.id)
    );
    const knownVictoryRuleSetIds = new Set(
      listVictoryRuleSets().map((entry: { id: string }) => entry.id)
    );

    serverModule.contentPacks.forEach((contentPackDefinition) => {
      try {
        if (findBuiltInContentPack(contentPackDefinition.id)) {
          throw new Error(
            `Runtime module content pack "${contentPackDefinition.id}" conflicts with a built-in content pack.`
          );
        }

        if (runtimeContentPacksById.has(contentPackDefinition.id)) {
          throw new Error(
            `Duplicate runtime module content pack "${contentPackDefinition.id}" detected.`
          );
        }

        if (!knownThemeIds.has(contentPackDefinition.defaultSiteThemeId)) {
          throw new Error(
            `Runtime module content pack "${contentPackDefinition.id}" references unknown site theme "${contentPackDefinition.defaultSiteThemeId}".`
          );
        }

        if (!knownMapIds.has(contentPackDefinition.defaultMapId)) {
          throw new Error(
            `Runtime module content pack "${contentPackDefinition.id}" references unknown map "${contentPackDefinition.defaultMapId}".`
          );
        }

        if (!knownDiceRuleSetIds.has(contentPackDefinition.defaultDiceRuleSetId)) {
          throw new Error(
            `Runtime module content pack "${contentPackDefinition.id}" references unknown dice rule set "${contentPackDefinition.defaultDiceRuleSetId}".`
          );
        }

        if (!knownCardRuleSetIds.has(contentPackDefinition.defaultCardRuleSetId)) {
          throw new Error(
            `Runtime module content pack "${contentPackDefinition.id}" references unknown card rule set "${contentPackDefinition.defaultCardRuleSetId}".`
          );
        }

        if (!knownVictoryRuleSetIds.has(contentPackDefinition.defaultVictoryRuleSetId)) {
          throw new Error(
            `Runtime module content pack "${contentPackDefinition.id}" references unknown victory rule set "${contentPackDefinition.defaultVictoryRuleSetId}".`
          );
        }

        if (!knownPieceSetIds.has(contentPackDefinition.defaultPieceSetId)) {
          throw new Error(
            `Runtime module content pack "${contentPackDefinition.id}" references unknown player piece set "${contentPackDefinition.defaultPieceSetId}".`
          );
        }

        runtimeContentPacksById.set(contentPackDefinition.id, {
          moduleId,
          contentPack: buildRuntimeModuleContentPack(contentPackDefinition)
        });
      } catch (error: unknown) {
        errors.push(`${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return errors;
  }

  function registerServerModulePlayerPieceSets(
    moduleId: string,
    serverModule: NetRiskServerModule,
    sourcePath: string
  ): string[] {
    if (!Array.isArray(serverModule.playerPieceSets) || !serverModule.playerPieceSets.length) {
      return [];
    }

    const errors: string[] = [];
    serverModule.playerPieceSets.forEach((pieceSetDefinition) => {
      try {
        if (findBuiltInPlayerPieceSet(pieceSetDefinition.id)) {
          throw new Error(
            `Runtime module player piece set "${pieceSetDefinition.id}" conflicts with a built-in player piece set.`
          );
        }

        if (runtimePlayerPieceSetsById.has(pieceSetDefinition.id)) {
          throw new Error(
            `Duplicate runtime module player piece set "${pieceSetDefinition.id}" detected.`
          );
        }

        runtimePlayerPieceSetsById.set(pieceSetDefinition.id, {
          moduleId,
          pieceSet: buildRuntimeModulePlayerPieceSet(pieceSetDefinition)
        });
      } catch (error: unknown) {
        errors.push(`${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return errors;
  }

  function registerServerModuleDiceRuleSets(
    moduleId: string,
    serverModule: NetRiskServerModule,
    sourcePath: string
  ): string[] {
    if (!Array.isArray(serverModule.diceRuleSets) || !serverModule.diceRuleSets.length) {
      return [];
    }

    const errors: string[] = [];
    serverModule.diceRuleSets.forEach((ruleSetDefinition) => {
      try {
        if (findBuiltInDiceRuleSet(ruleSetDefinition.id)) {
          throw new Error(
            `Runtime module dice rule set "${ruleSetDefinition.id}" conflicts with a built-in dice rule set.`
          );
        }

        if (runtimeDiceRuleSetsById.has(ruleSetDefinition.id)) {
          throw new Error(
            `Duplicate runtime module dice rule set "${ruleSetDefinition.id}" detected.`
          );
        }

        runtimeDiceRuleSetsById.set(ruleSetDefinition.id, {
          moduleId,
          diceRuleSet: buildRuntimeModuleDiceRuleSet(ruleSetDefinition)
        });
      } catch (error: unknown) {
        errors.push(`${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return errors;
  }

  function listEnabledRuntimeMaps(modules: NetRiskInstalledModule[]): RuntimeModuleMapEntry[] {
    const enabledIds = new Set(
      modules
        .filter((moduleEntry) => moduleEntry.enabled && moduleEntry.compatible)
        .map((moduleEntry) => moduleEntry.id)
    );

    return Array.from(runtimeMapsById.values())
      .filter((entry) => enabledIds.has(entry.moduleId))
      .map((entry) => ({
        moduleId: entry.moduleId,
        map: cloneSupportedMap(entry.map)
      }));
  }

  function listEnabledRuntimeContentPacks(
    modules: NetRiskInstalledModule[]
  ): RuntimeModuleContentPackEntry[] {
    const enabledIds = new Set(
      modules
        .filter((moduleEntry) => moduleEntry.enabled && moduleEntry.compatible)
        .map((moduleEntry) => moduleEntry.id)
    );

    return Array.from(runtimeContentPacksById.values())
      .filter((entry) => enabledIds.has(entry.moduleId))
      .map((entry) => ({
        moduleId: entry.moduleId,
        contentPack: cloneContentPackSummary(entry.contentPack)
      }));
  }

  function listEnabledRuntimePlayerPieceSets(
    modules: NetRiskInstalledModule[]
  ): RuntimeModulePlayerPieceSetEntry[] {
    const enabledIds = new Set(
      modules
        .filter((moduleEntry) => moduleEntry.enabled && moduleEntry.compatible)
        .map((moduleEntry) => moduleEntry.id)
    );

    return Array.from(runtimePlayerPieceSetsById.values())
      .filter((entry) => enabledIds.has(entry.moduleId))
      .map((entry) => ({
        moduleId: entry.moduleId,
        pieceSet: clonePlayerPieceSet(entry.pieceSet)
      }));
  }

  function listEnabledRuntimeDiceRuleSets(
    modules: NetRiskInstalledModule[]
  ): RuntimeModuleDiceRuleSetEntry[] {
    const enabledIds = new Set(
      modules
        .filter((moduleEntry) => moduleEntry.enabled && moduleEntry.compatible)
        .map((moduleEntry) => moduleEntry.id)
    );

    return Array.from(runtimeDiceRuleSetsById.values())
      .filter((entry) => enabledIds.has(entry.moduleId))
      .map((entry) => ({
        moduleId: entry.moduleId,
        diceRuleSet: cloneDiceRuleSet(entry.diceRuleSet)
      }));
  }

  async function loadCatalogState(): Promise<CatalogState> {
    if (cachedState) {
      return cachedState;
    }

    const rawState =
      typeof options.datastore.getAppState === "function"
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
      ? fs
          .readdirSync(modulesRoot, { withFileTypes: true })
          .filter((entry: { isDirectory: () => boolean }) => entry.isDirectory())
      : [];

    moduleDirectories.forEach((directory: { name: string }) => {
      const moduleRoot = path.join(modulesRoot, directory.name);
      const manifestPath = path.join(moduleRoot, "module.json");
      if (!fs.existsSync(manifestPath)) {
        return;
      }

      try {
        const manifest = validateNetRiskModuleManifest(safeReadJson(manifestPath), manifestPath);
        const clientManifestResult = loadClientManifest(moduleRoot, manifest);
        const serverModuleResult = loadServerModule(moduleRoot, manifest, options.projectRoot);
        const moduleMapErrors = serverModuleResult.serverModule
          ? registerServerModuleMaps(manifest.id, serverModuleResult.serverModule, manifestPath)
          : [];
        const moduleEntry = baseInstalledModuleFromManifest(
          manifest,
          moduleRoot,
          enabledById,
          clientManifestResult.clientManifest,
          clientManifestResult.clientManifestPath,
          [...clientManifestResult.warnings, ...serverModuleResult.warnings],
          [...clientManifestResult.errors, ...serverModuleResult.errors, ...moduleMapErrors]
        );
        if (serverModuleResult.serverModule) {
          serverModulesById.set(manifest.id, serverModuleResult.serverModule);
        }
        if (clientManifestResult.errors.length) {
          moduleEntry.compatible = false;
          moduleEntry.status = "error";
        }
        if (serverModuleResult.errors.length) {
          moduleEntry.compatible = false;
          moduleEntry.status = "error";
        }
        if (moduleMapErrors.length) {
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
    serverModulesById = new Map<string, NetRiskServerModule>();
    runtimeMapsById = new Map<string, RuntimeModuleMapEntry>();
    runtimeContentPacksById = new Map<string, RuntimeModuleContentPackEntry>();
    runtimePlayerPieceSetsById = new Map<string, RuntimeModulePlayerPieceSetEntry>();
    runtimeDiceRuleSetsById = new Map<string, RuntimeModuleDiceRuleSetEntry>();
    const coreManifestPath = path.join(modulesRoot, CORE_MODULE_ID, "module.json");
    let coreManifest = defaultCoreManifest();
    let coreWarnings: string[] = [];
    let coreErrors: string[] = [];
    let coreClientManifest = defaultCoreClientManifest();
    let coreClientManifestPath: string | null = null;

    if (fs.existsSync(coreManifestPath)) {
      try {
        coreManifest = validateNetRiskModuleManifest(
          safeReadJson(coreManifestPath),
          coreManifestPath
        );
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

      const serverModuleResult = loadServerModule(
        coreModuleRoot,
        coreManifest,
        options.projectRoot
      );
      if (serverModuleResult.serverModule) {
        serverModulesById.set(CORE_MODULE_ID, serverModuleResult.serverModule);
        coreErrors = coreErrors.concat(
          registerServerModuleMaps(
            CORE_MODULE_ID,
            serverModuleResult.serverModule,
            coreManifestPath
          )
        );
      }
      coreWarnings = coreWarnings.concat(serverModuleResult.warnings);
      coreErrors = coreErrors.concat(serverModuleResult.errors);
    }

    const filesystemModules = scanFilesystemModules(catalogState.enabledById).filter(
      (moduleEntry) => moduleEntry.id !== CORE_MODULE_ID
    );
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
      const serverModule = serverModulesById.get(moduleEntry.id);
      if (!serverModule) {
        return;
      }

      const diceRuleSetErrors = registerServerModuleDiceRuleSets(
        moduleEntry.id,
        serverModule,
        moduleEntry.sourcePath
      );
      if (diceRuleSetErrors.length) {
        moduleEntry.errors.push(...diceRuleSetErrors);
        moduleEntry.compatible = false;
        moduleEntry.status = "error";
      }
    });

    manifestModules.forEach((moduleEntry) => {
      const serverModule = serverModulesById.get(moduleEntry.id);
      if (!serverModule) {
        return;
      }

      const pieceSetErrors = registerServerModulePlayerPieceSets(
        moduleEntry.id,
        serverModule,
        moduleEntry.sourcePath
      );
      if (pieceSetErrors.length) {
        moduleEntry.errors.push(...pieceSetErrors);
        moduleEntry.compatible = false;
        moduleEntry.status = "error";
      }
    });

    manifestModules.forEach((moduleEntry) => {
      const serverModule = serverModulesById.get(moduleEntry.id);
      if (!serverModule) {
        return;
      }

      const contentPackErrors = registerServerModuleContentPacks(
        moduleEntry.id,
        serverModule,
        moduleEntry.sourcePath
      );
      if (contentPackErrors.length) {
        moduleEntry.errors.push(...contentPackErrors);
        moduleEntry.compatible = false;
        moduleEntry.status = "error";
      }
    });

    manifestModules.forEach((moduleEntry) => {
      const manifest = moduleEntry.manifest as NetRiskModuleManifest;
      if (!isEngineVersionCompatible(NETRISK_ENGINE_VERSION, manifest.engineVersion)) {
        moduleEntry.compatible = false;
        moduleEntry.errors.push(
          `Engine version mismatch: requires ${manifest.engineVersion}, current engine is ${NETRISK_ENGINE_VERSION}.`
        );
      }

      manifest.dependencies.forEach((dependency) => {
        if (!discoveredIds.has(dependency.id) && !dependency.optional) {
          moduleEntry.compatible = false;
          moduleEntry.errors.push(`Missing dependency "${dependency.id}".`);
        }
      });
    });

    const enabledIds = new Set(
      modules.filter((moduleEntry) => moduleEntry.enabled).map((moduleEntry) => moduleEntry.id)
    );
    enabledIds.add(CORE_MODULE_ID);

    manifestModules.forEach((moduleEntry) => {
      const manifest = moduleEntry.manifest as NetRiskModuleManifest;
      if (moduleEntry.enabled) {
        const blockingDependency = manifest.dependencies.find(
          (dependency) => !dependency.optional && !enabledIds.has(dependency.id)
        );
        if (blockingDependency) {
          moduleEntry.compatible = false;
          moduleEntry.errors.push(`Dependency "${blockingDependency.id}" must be enabled first.`);
        }

        const conflictingModuleId = manifest.conflicts.find((conflictId) =>
          enabledIds.has(conflictId)
        );
        if (conflictingModuleId) {
          moduleEntry.compatible = false;
          moduleEntry.errors.push(`Conflicts with enabled module "${conflictingModuleId}".`);
        }
      }

      if (!moduleEntry.errors.length && moduleEntry.enabled) {
        moduleEntry.status = "enabled";
      } else if (!moduleEntry.errors.length && !moduleEntry.enabled) {
        moduleEntry.status =
          catalogState.enabledById[moduleEntry.id] === false ? "disabled" : "validated";
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
    const modules = await ensureCatalog();
    await refreshAuthoredVictoryRuleSets();
    return buildModuleOptions(
      modules,
      listEnabledRuntimeMaps(modules),
      listEnabledRuntimeContentPacks(modules),
      listEnabledRuntimePlayerPieceSets(modules),
      listEnabledRuntimeDiceRuleSets(modules),
      authoredVictoryRuleSets
    );
  }

  async function refreshAuthoredVictoryRuleSets() {
    if (typeof options.authoredModules?.listPublishedVictoryRuleSets !== "function") {
      authoredVictoryRuleSets = [];
      authoredVictoryRuleSetRuntimesById = new Map();
      return;
    }

    const published = await options.authoredModules.listPublishedVictoryRuleSets();
    authoredVictoryRuleSets = Array.isArray(published)
      ? published.map((entry) => ({
          ...entry,
          runtime: cloneAuthoredVictoryRuntime(entry.runtime)
        }))
      : [];
    authoredVictoryRuleSetRuntimesById = new Map(
      authoredVictoryRuleSets.map((entry) => [entry.id, cloneAuthoredVictoryRuntime(entry.runtime)])
    );
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
    listSupportedMaps(): SupportedMap[] {
      const builtInMaps = listCoreBaseMapSummaries()
        .map((summary: { id: string }) => findCoreBaseSupportedMap(summary.id))
        .filter((entry: SupportedMap | null): entry is SupportedMap => Boolean(entry))
        .map(cloneSupportedMap);
      const runtimeMaps = Array.from(runtimeMapsById.values())
        .filter((runtimeEntry) => {
          const ownerModule = cachedModules.find(
            (moduleEntry) => moduleEntry.id === runtimeEntry.moduleId
          );
          return Boolean(ownerModule?.enabled && ownerModule.compatible);
        })
        .map((runtimeEntry) => cloneSupportedMap(runtimeEntry.map));

      return [...builtInMaps, ...runtimeMaps];
    },
    findSupportedMap(mapId: string): SupportedMap | null {
      const builtInMap = findCoreBaseSupportedMap(mapId);
      if (builtInMap) {
        return cloneSupportedMap(builtInMap);
      }

      const runtimeEntry = runtimeMapsById.get(mapId);
      if (!runtimeEntry) {
        return null;
      }

      const ownerModule = cachedModules.find(
        (moduleEntry) => moduleEntry.id === runtimeEntry.moduleId
      );
      if (!ownerModule || !ownerModule.enabled || !ownerModule.compatible) {
        return null;
      }

      return cloneSupportedMap(runtimeEntry.map);
    },
    findContentPack(contentPackId: string): ContentPackSummary | null {
      const builtInContentPack = findBuiltInContentPack(contentPackId);
      if (builtInContentPack) {
        return cloneContentPackSummary(builtInContentPack);
      }

      const runtimeEntry = runtimeContentPacksById.get(contentPackId);
      if (!runtimeEntry) {
        return null;
      }

      const ownerModule = cachedModules.find(
        (moduleEntry) => moduleEntry.id === runtimeEntry.moduleId
      );
      if (!ownerModule || !ownerModule.enabled || !ownerModule.compatible) {
        return null;
      }

      return cloneContentPackSummary(runtimeEntry.contentPack);
    },
    findPlayerPieceSet(pieceSetId: string): PlayerPieceSet | null {
      const builtInPieceSet = findBuiltInPlayerPieceSet(pieceSetId);
      if (builtInPieceSet) {
        return clonePlayerPieceSet(builtInPieceSet);
      }

      const runtimeEntry = runtimePlayerPieceSetsById.get(pieceSetId);
      if (!runtimeEntry) {
        return null;
      }

      const ownerModule = cachedModules.find(
        (moduleEntry) => moduleEntry.id === runtimeEntry.moduleId
      );
      if (!ownerModule || !ownerModule.enabled || !ownerModule.compatible) {
        return null;
      }

      return clonePlayerPieceSet(runtimeEntry.pieceSet);
    },
    findDiceRuleSet(diceRuleSetId: string): DiceRuleSet | null {
      const builtInDiceRuleSet = findBuiltInDiceRuleSet(diceRuleSetId);
      if (builtInDiceRuleSet) {
        return cloneDiceRuleSet(builtInDiceRuleSet);
      }

      const runtimeEntry = runtimeDiceRuleSetsById.get(diceRuleSetId);
      if (!runtimeEntry) {
        return null;
      }

      const ownerModule = cachedModules.find(
        (moduleEntry) => moduleEntry.id === runtimeEntry.moduleId
      );
      if (!ownerModule || !ownerModule.enabled || !ownerModule.compatible) {
        return null;
      }

      return cloneDiceRuleSet(runtimeEntry.diceRuleSet);
    },
    findVictoryRuleSet(victoryRuleSetId: string): VictoryRuleSet | null {
      const builtInVictoryRuleSet = findBuiltInVictoryRuleSet(victoryRuleSetId);
      if (builtInVictoryRuleSet) {
        return cloneVictoryRuleSet(builtInVictoryRuleSet);
      }

      const authoredVictoryRuleSet =
        authoredVictoryRuleSets.find((entry) => entry.id === victoryRuleSetId) || null;
      if (!authoredVictoryRuleSet) {
        return null;
      }

      return cloneVictoryRuleSet({
        id: authoredVictoryRuleSet.id,
        name: authoredVictoryRuleSet.name,
        description: authoredVictoryRuleSet.description,
        source: authoredVictoryRuleSet.source,
        mapId: authoredVictoryRuleSet.mapId || null,
        objectiveCount:
          typeof authoredVictoryRuleSet.objectiveCount === "number"
            ? authoredVictoryRuleSet.objectiveCount
            : undefined,
        moduleType: authoredVictoryRuleSet.moduleType || null
      });
    },
    findVictoryRuleSetRuntime(victoryRuleSetId: string): AuthoredVictoryModuleRuntime | null {
      const runtime = authoredVictoryRuleSetRuntimesById.get(victoryRuleSetId);
      return runtime ? cloneAuthoredVictoryRuntime(runtime) : null;
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
        throw new Error(
          `Module "${moduleId}" is not compatible: ${target.errors.join(" ")}`.trim()
        );
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
    async resolveGameConfigDefaults(
      input: {
        activeModuleIds?: string[];
        contentProfileId?: string | null;
        gameplayProfileId?: string | null;
        uiProfileId?: string | null;
      } = {}
    ): Promise<NetRiskResolvedModuleSetup> {
      const optionsSnapshot = await getModuleOptions();
      const requestedIds = Array.isArray(input.activeModuleIds)
        ? Array.from(new Set(input.activeModuleIds.filter((value) => isNonEmptyString(value))))
        : [];
      const selectedModuleEntries = moduleEntriesForSelection(
        optionsSnapshot.gameModules,
        requestedIds
      );
      const selectedModuleIds = new Set(selectedModuleEntries.map((moduleEntry) => moduleEntry.id));
      const resolvedDefaults: NetRiskModuleConfigDefaults = {};
      let resolvedGameplayEffects: NetRiskGameplayEffects = {
        reinforcementAdjustments: [],
        majorityControlThresholdPercent: null,
        conquestMinimumArmies: null,
        fortifyMinimumArmies: null,
        requiredFortifyWhenAvailable: null,
        attackMinimumArmies: null,
        attackLimitPerTurn: null,
        minimumAttacksPerTurn: null
      };
      let resolvedScenarioSetup: NetRiskScenarioSetup = {
        territoryBonuses: [],
        logMessage: null
      };

      if (input.contentProfileId) {
        selectedModuleEntries.forEach((moduleEntry) => {
          const serverModule = serverModulesById.get(moduleEntry.id);
          const profile = serverModule?.profiles?.content?.find(
            (entry) => entry.id === input.contentProfileId
          );
          if (profile) {
            Object.assign(
              resolvedDefaults,
              mergeConfigDefaults(resolvedDefaults, profile.defaults)
            );
            resolvedGameplayEffects = mergeGameplayEffects(
              resolvedGameplayEffects,
              profile.gameplayEffects
            );
            resolvedScenarioSetup = mergeScenarioSetup(
              resolvedScenarioSetup,
              profile.scenarioSetup
            );
          }
        });
      }

      if (input.gameplayProfileId) {
        selectedModuleEntries.forEach((moduleEntry) => {
          const serverModule = serverModulesById.get(moduleEntry.id);
          const profile = serverModule?.profiles?.gameplay?.find(
            (entry) => entry.id === input.gameplayProfileId
          );
          if (profile) {
            Object.assign(
              resolvedDefaults,
              mergeConfigDefaults(resolvedDefaults, profile.defaults)
            );
            resolvedGameplayEffects = mergeGameplayEffects(
              resolvedGameplayEffects,
              profile.gameplayEffects
            );
            resolvedScenarioSetup = mergeScenarioSetup(
              resolvedScenarioSetup,
              profile.scenarioSetup
            );
          }
        });
      }

      if (input.uiProfileId) {
        selectedModuleEntries.forEach((moduleEntry) => {
          const serverModule = serverModulesById.get(moduleEntry.id);
          const profile = serverModule?.profiles?.ui?.find(
            (entry) => entry.id === input.uiProfileId
          );
          if (profile) {
            Object.assign(
              resolvedDefaults,
              mergeConfigDefaults(resolvedDefaults, profile.defaults)
            );
            resolvedGameplayEffects = mergeGameplayEffects(
              resolvedGameplayEffects,
              profile.gameplayEffects
            );
            resolvedScenarioSetup = mergeScenarioSetup(
              resolvedScenarioSetup,
              profile.scenarioSetup
            );
          }
        });
      }

      if (
        input.contentProfileId &&
        !optionsSnapshot.contentProfiles.some(
          (profile) =>
            profile.id === input.contentProfileId &&
            (!profile.moduleId || selectedModuleIds.has(profile.moduleId))
        )
      ) {
        throw new Error(`Unknown content profile "${input.contentProfileId}".`);
      }

      if (
        input.gameplayProfileId &&
        !optionsSnapshot.gameplayProfiles.some(
          (profile) =>
            profile.id === input.gameplayProfileId &&
            (!profile.moduleId || selectedModuleIds.has(profile.moduleId))
        )
      ) {
        throw new Error(`Unknown gameplay profile "${input.gameplayProfileId}".`);
      }

      if (
        input.uiProfileId &&
        !optionsSnapshot.uiProfiles.some(
          (profile) =>
            profile.id === input.uiProfileId &&
            (!profile.moduleId || selectedModuleIds.has(profile.moduleId))
        )
      ) {
        throw new Error(`Unknown UI profile "${input.uiProfileId}".`);
      }

      return {
        defaults: resolvedDefaults,
        gameplayEffects:
          resolvedGameplayEffects.reinforcementAdjustments?.length ||
          typeof resolvedGameplayEffects.majorityControlThresholdPercent === "number" ||
          typeof resolvedGameplayEffects.conquestMinimumArmies === "number" ||
          typeof resolvedGameplayEffects.fortifyMinimumArmies === "number" ||
          typeof resolvedGameplayEffects.requiredFortifyWhenAvailable === "boolean" ||
          typeof resolvedGameplayEffects.attackMinimumArmies === "number" ||
          typeof resolvedGameplayEffects.attackLimitPerTurn === "number" ||
          typeof resolvedGameplayEffects.minimumAttacksPerTurn === "number"
            ? resolvedGameplayEffects
            : null,
        scenarioSetup:
          resolvedScenarioSetup.territoryBonuses?.length || resolvedScenarioSetup.logMessage
            ? resolvedScenarioSetup
            : null
      };
    },
    async resolveGamePreset(
      input: {
        gamePresetId?: string | null;
        activeModuleIds?: string[];
      } = {}
    ): Promise<NetRiskResolvedGamePreset | null> {
      if (!isNonEmptyString(input.gamePresetId)) {
        return null;
      }

      const optionsSnapshot = await getModuleOptions();
      const preset =
        optionsSnapshot.gamePresets.find((entry) => entry.id === input.gamePresetId) || null;
      if (!preset) {
        throw new Error(`Unknown game preset "${input.gamePresetId}".`);
      }

      const activeModuleIds = Array.from(
        new Set([
          ...(Array.isArray(preset.activeModuleIds) ? preset.activeModuleIds : []).filter((value) =>
            isNonEmptyString(value)
          ),
          ...(preset.moduleId && preset.moduleId !== CORE_MODULE_ID ? [preset.moduleId] : [])
        ])
      );

      activeModuleIds.forEach((moduleId) => {
        const match = optionsSnapshot.gameModules.find(
          (moduleEntry) => moduleEntry.id === moduleId
        );
        if (!match || !match.enabled || !match.compatible) {
          throw new Error(
            `Game preset "${input.gamePresetId}" requires unavailable module "${moduleId}".`
          );
        }
      });

      return {
        id: preset.id,
        name: preset.name,
        description: preset.description || null,
        moduleId: preset.moduleId || null,
        activeModuleIds,
        contentProfileId: preset.contentProfileId || null,
        gameplayProfileId: preset.gameplayProfileId || null,
        uiProfileId: preset.uiProfileId || null,
        defaults: preset.defaults ? { ...preset.defaults } : null
      };
    },
    async resolveGameSelection(
      input: {
        activeModuleIds?: string[];
        contentProfileId?: string | null;
        gameplayProfileId?: string | null;
        uiProfileId?: string | null;
        contentPackId?: string | null;
        pieceSetId?: string | null;
        mapId?: string | null;
        diceRuleSetId?: string | null;
        victoryRuleSetId?: string | null;
        themeId?: string | null;
        pieceSkinId?: string | null;
      } = {}
    ): Promise<NetRiskGameModuleSelection> {
      const optionsSnapshot = await getModuleOptions();
      const requestedIds = Array.isArray(input.activeModuleIds)
        ? Array.from(new Set(input.activeModuleIds.filter((value) => isNonEmptyString(value))))
        : [];
      const selectedModuleRefs = requestedIds.map((moduleId) => {
        const match = optionsSnapshot.gameModules.find(
          (moduleEntry) => moduleEntry.id === moduleId
        );
        if (!match || !match.version) {
          throw new Error(`Game module "${moduleId}" is not available.`);
        }
        return {
          id: match.id,
          version: match.version
        };
      });

      const selectedModuleEntries = moduleEntriesForSelection(
        optionsSnapshot.gameModules,
        requestedIds
      );
      const selectedContentProfiles = summarizeProfiles(selectedModuleEntries, "content");
      const selectedGameplayProfiles = summarizeProfiles(selectedModuleEntries, "gameplay");
      const selectedUiProfiles = summarizeProfiles(selectedModuleEntries, "ui");
      const selectedContent = aggregateContentContribution(
        selectedModuleEntries,
        listEnabledRuntimeMaps(selectedModuleEntries),
        listEnabledRuntimeContentPacks(selectedModuleEntries),
        listEnabledRuntimePlayerPieceSets(selectedModuleEntries),
        listEnabledRuntimeDiceRuleSets(selectedModuleEntries)
      );
      if (authoredVictoryRuleSets.length) {
        selectedContent.victoryRuleSetIds = Array.from(
          new Set([
            ...(selectedContent.victoryRuleSetIds || []),
            ...authoredVictoryRuleSets.map((entry) => entry.id)
          ])
        );
      }
      const availableContentProfiles = new Set(
        selectedContentProfiles.map((profile) => profile.id)
      );
      const availableGameplayProfiles = new Set(
        selectedGameplayProfiles.map((profile) => profile.id)
      );
      const availableUiProfiles = new Set(selectedUiProfiles.map((profile) => profile.id));

      if (input.contentProfileId && !availableContentProfiles.has(input.contentProfileId)) {
        throw new Error(`Unknown content profile "${input.contentProfileId}".`);
      }

      if (input.gameplayProfileId && !availableGameplayProfiles.has(input.gameplayProfileId)) {
        throw new Error(`Unknown gameplay profile "${input.gameplayProfileId}".`);
      }

      if (input.uiProfileId && !availableUiProfiles.has(input.uiProfileId)) {
        throw new Error(`Unknown UI profile "${input.uiProfileId}".`);
      }

      ensureAllowedContentId(
        "content pack",
        input.contentPackId || null,
        selectedContent.contentPackIds
      );
      ensureAllowedContentId(
        "piece set",
        input.pieceSetId || null,
        selectedContent.playerPieceSetIds
      );
      ensureAllowedContentId("map", input.mapId || null, selectedContent.mapIds);
      ensureAllowedContentId(
        "dice rule set",
        input.diceRuleSetId || null,
        selectedContent.diceRuleSetIds
      );
      ensureAllowedContentId(
        "victory rule set",
        input.victoryRuleSetId || null,
        selectedContent.victoryRuleSetIds
      );
      ensureAllowedContentId("theme", input.themeId || null, selectedContent.siteThemeIds);
      ensureAllowedContentId("piece skin", input.pieceSkinId || null, selectedContent.pieceSkinIds);

      return normalizeNetRiskGameModuleSelection({
        activeModules: [coreModuleReference(), ...selectedModuleRefs],
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
