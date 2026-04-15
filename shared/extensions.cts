import { DEFENSE_THREE_DICE_RULE_SET_ID, STANDARD_DICE_RULE_SET_ID, findDiceRuleSet, getDiceRuleSet, listDiceRuleSets } from "./dice.cjs";
import { findSupportedMap, listSupportedMaps } from "./maps/index.cjs";
import {
  NETRISK_MODULE_SCHEMA_VERSION,
  normalizeNetRiskGameModuleSelection,
  type NetRiskGameModuleSelection,
  type NetRiskModuleReference
} from "./netrisk-modules.cjs";

export const EXTENSION_SCHEMA_VERSION = 1;
export const DEFAULT_EXTENSION_PACK_ID = "classic";
export const DEFAULT_VICTORY_RULE_SET_ID = "conquest";
export const MAJORITY_CONTROL_VICTORY_RULE_SET_ID = "majority-control";
export const DEFAULT_THEME_ID = "command";
export const DEFAULT_PIECE_SKIN_ID = "classic-color";

export interface MapDefinition {
  id: string;
  name: string;
}

export interface VictoryRuleSet {
  id: string;
  name: string;
  description: string;
}

export interface VisualTheme {
  id: string;
  name: string;
  description: string;
}

export interface PieceSkin {
  id: string;
  name: string;
  description: string;
  renderStyleId: string;
  usesPlayerColor: boolean;
  assetBaseUrl?: string | null;
}

export interface ExtensionSelection {
  extensionSchemaVersion: number;
  mapId: string;
  diceRuleSetId: string;
  victoryRuleSetId: string;
  themeId: string;
  pieceSkinId: string;
}

export interface ExtensionPackManifest {
  id: string;
  name: string;
  version: number;
  defaults: Omit<ExtensionSelection, "extensionSchemaVersion">;
  mapIds: string[];
  diceRuleSetIds: string[];
  victoryRuleSetIds: string[];
  themeIds: string[];
  pieceSkinIds: string[];
}

export interface ExtensionPackSummary extends ExtensionPackManifest {
  defaults: ExtensionSelection;
}

export interface ExtensionCatalogValidationResult {
  packs: ExtensionPackManifest[];
}

export interface ExtensionAwareGameConfig extends ExtensionSelection {
  moduleSchemaVersion?: number;
  activeModules?: NetRiskModuleReference[];
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
  name?: string;
  ruleSetId?: string;
  ruleSetName?: string;
  mapName?: string | null;
  turnTimeoutHours?: number | null;
  totalPlayers?: number;
  players?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

type ExtensionGameStateLike = {
  mapId?: unknown;
  mapName?: unknown;
  diceRuleSetId?: unknown;
  gameConfig?: Record<string, unknown> | null;
};

const victoryRuleSets = Object.freeze<Record<string, Readonly<VictoryRuleSet>>>({
  [DEFAULT_VICTORY_RULE_SET_ID]: Object.freeze({
    id: DEFAULT_VICTORY_RULE_SET_ID,
    name: "Conquest",
    description: "Win by being the only active player with territories left on the map."
  }),
  [MAJORITY_CONTROL_VICTORY_RULE_SET_ID]: Object.freeze({
    id: MAJORITY_CONTROL_VICTORY_RULE_SET_ID,
    name: "Majority Control",
    description: "Win immediately by controlling at least 70% of the map's territories."
  })
});

const visualThemes = Object.freeze<Record<string, Readonly<VisualTheme>>>({
  command: Object.freeze({
    id: "command",
    name: "Command",
    description: "Operational default theme with high-contrast military styling."
  }),
  midnight: Object.freeze({
    id: "midnight",
    name: "Midnight",
    description: "Low-light command center palette for darker play sessions."
  }),
  ember: Object.freeze({
    id: "ember",
    name: "Ember",
    description: "Warm signal-room palette with brighter accents."
  })
});

const pieceSkins = Object.freeze<Record<string, Readonly<PieceSkin>>>({
  [DEFAULT_PIECE_SKIN_ID]: Object.freeze({
    id: DEFAULT_PIECE_SKIN_ID,
    name: "Classic Color",
    description: "Uses each player's command color for board markers and tokens.",
    renderStyleId: "solid-fill",
    usesPlayerColor: true,
    assetBaseUrl: null
  }),
  "command-ring": Object.freeze({
    id: "command-ring",
    name: "Command Ring",
    description: "Renders territory markers as command rings with a tactical core and player-color accents.",
    renderStyleId: "ring-core",
    usesPlayerColor: true,
    assetBaseUrl: null
  })
});

const rawExtensionPacks = Object.freeze<Record<string, Readonly<ExtensionPackManifest>>>({
  classic: Object.freeze({
    id: "classic",
    name: "Classic",
    version: 1,
    defaults: {
      mapId: "classic-mini",
      diceRuleSetId: STANDARD_DICE_RULE_SET_ID,
      victoryRuleSetId: DEFAULT_VICTORY_RULE_SET_ID,
      themeId: DEFAULT_THEME_ID,
      pieceSkinId: DEFAULT_PIECE_SKIN_ID
    },
    mapIds: listSupportedMaps().map((map) => map.id),
    diceRuleSetIds: listDiceRuleSets().map((ruleSet) => ruleSet.id),
    victoryRuleSetIds: Object.keys(victoryRuleSets),
    themeIds: Object.keys(visualThemes),
    pieceSkinIds: Object.keys(pieceSkins)
  }),
  "classic-defense-3": Object.freeze({
    id: "classic-defense-3",
    name: "Classic Defense 3",
    version: 1,
    defaults: {
      mapId: "classic-mini",
      diceRuleSetId: DEFENSE_THREE_DICE_RULE_SET_ID,
      victoryRuleSetId: DEFAULT_VICTORY_RULE_SET_ID,
      themeId: DEFAULT_THEME_ID,
      pieceSkinId: DEFAULT_PIECE_SKIN_ID
    },
    mapIds: listSupportedMaps().map((map) => map.id),
    diceRuleSetIds: listDiceRuleSets().map((ruleSet) => ruleSet.id),
    victoryRuleSetIds: Object.keys(victoryRuleSets),
    themeIds: Object.keys(visualThemes),
    pieceSkinIds: Object.keys(pieceSkins)
  })
});

function ensureKnownIds(kind: string, packId: string, ids: string[], knownIds: Set<string>): void {
  ids.forEach((id) => {
    if (!knownIds.has(id)) {
      throw new Error(`Extension pack "${packId}" references unknown ${kind} id "${id}".`);
    }
  });
}

function ensureDefaultIncluded(kind: string, packId: string, defaultId: string, ids: string[]): void {
  if (!ids.includes(defaultId)) {
    throw new Error(`Extension pack "${packId}" must include default ${kind} id "${defaultId}" in its capability list.`);
  }
}

export function validateExtensionPackCatalog(packs: ExtensionPackManifest[]): ExtensionCatalogValidationResult {
  const knownMapIds = new Set(listSupportedMaps().map((map) => map.id));
  const knownDiceRuleSetIds = new Set(listDiceRuleSets().map((ruleSet) => ruleSet.id));
  const knownVictoryRuleSetIds = new Set(Object.keys(victoryRuleSets));
  const knownThemeIds = new Set(Object.keys(visualThemes));
  const knownPieceSkinIds = new Set(Object.keys(pieceSkins));
  const seenPackIds = new Set<string>();

  packs.forEach((pack) => {
    if (!pack || typeof pack !== "object") {
      throw new Error("Extension pack catalog contains an invalid pack entry.");
    }

    if (!pack.id || typeof pack.id !== "string") {
      throw new Error("Extension pack catalog contains a pack without a valid id.");
    }

    if (seenPackIds.has(pack.id)) {
      throw new Error(`Duplicate extension pack id "${pack.id}" detected.`);
    }
    seenPackIds.add(pack.id);

    ensureKnownIds("map", pack.id, pack.mapIds || [], knownMapIds);
    ensureKnownIds("dice rule set", pack.id, pack.diceRuleSetIds || [], knownDiceRuleSetIds);
    ensureKnownIds("victory rule set", pack.id, pack.victoryRuleSetIds || [], knownVictoryRuleSetIds);
    ensureKnownIds("theme", pack.id, pack.themeIds || [], knownThemeIds);
    ensureKnownIds("piece skin", pack.id, pack.pieceSkinIds || [], knownPieceSkinIds);

    ensureDefaultIncluded("map", pack.id, pack.defaults.mapId, pack.mapIds || []);
    ensureDefaultIncluded("dice rule set", pack.id, pack.defaults.diceRuleSetId, pack.diceRuleSetIds || []);
    ensureDefaultIncluded("victory rule set", pack.id, pack.defaults.victoryRuleSetId, pack.victoryRuleSetIds || []);
    ensureDefaultIncluded("theme", pack.id, pack.defaults.themeId, pack.themeIds || []);
    ensureDefaultIncluded("piece skin", pack.id, pack.defaults.pieceSkinId, pack.pieceSkinIds || []);
  });

  return {
    packs: packs.map((pack) => ({
      ...pack,
      defaults: { ...pack.defaults },
      mapIds: [...pack.mapIds],
      diceRuleSetIds: [...pack.diceRuleSetIds],
      victoryRuleSetIds: [...pack.victoryRuleSetIds],
      themeIds: [...pack.themeIds],
      pieceSkinIds: [...pack.pieceSkinIds]
    }))
  };
}

const extensionPacks = Object.freeze<Record<string, Readonly<ExtensionPackManifest>>>(
  Object.fromEntries(
    validateExtensionPackCatalog(Object.values(rawExtensionPacks)).packs.map((pack) => [pack.id, Object.freeze(pack)])
  ) as Record<string, Readonly<ExtensionPackManifest>>
);

function readableMapName(mapId: string | null | undefined): string | null {
  const map = findSupportedMap(mapId || "");
  return map ? map.name : (mapId || null);
}

export function findVictoryRuleSet(ruleSetId: string | null | undefined): Readonly<VictoryRuleSet> | null {
  if (!ruleSetId) {
    return null;
  }

  return victoryRuleSets[String(ruleSetId)] || null;
}

export function getVictoryRuleSet(ruleSetId: string = DEFAULT_VICTORY_RULE_SET_ID): Readonly<VictoryRuleSet> {
  return findVictoryRuleSet(ruleSetId) || victoryRuleSets[DEFAULT_VICTORY_RULE_SET_ID];
}

export function listVictoryRuleSets(): VictoryRuleSet[] {
  return Object.values(victoryRuleSets).map((ruleSet) => ({ ...ruleSet }));
}

export function findVisualTheme(themeId: string | null | undefined): Readonly<VisualTheme> | null {
  if (!themeId) {
    return null;
  }

  return visualThemes[String(themeId)] || null;
}

export function getVisualTheme(themeId: string = DEFAULT_THEME_ID): Readonly<VisualTheme> {
  return findVisualTheme(themeId) || visualThemes[DEFAULT_THEME_ID];
}

export function listVisualThemes(): VisualTheme[] {
  return Object.values(visualThemes).map((theme) => ({ ...theme }));
}

export function findPieceSkin(pieceSkinId: string | null | undefined): Readonly<PieceSkin> | null {
  if (!pieceSkinId) {
    return null;
  }

  return pieceSkins[String(pieceSkinId)] || null;
}

export function getPieceSkin(pieceSkinId: string = DEFAULT_PIECE_SKIN_ID): Readonly<PieceSkin> {
  return findPieceSkin(pieceSkinId) || pieceSkins[DEFAULT_PIECE_SKIN_ID];
}

export function listPieceSkins(): PieceSkin[] {
  return Object.values(pieceSkins).map((skin) => ({ ...skin }));
}

export function findExtensionPack(packId: string | null | undefined): Readonly<ExtensionPackManifest> | null {
  if (!packId) {
    return null;
  }

  return extensionPacks[String(packId)] || null;
}

export function getExtensionPack(packId: string = DEFAULT_EXTENSION_PACK_ID): Readonly<ExtensionPackManifest> {
  return findExtensionPack(packId) || extensionPacks[DEFAULT_EXTENSION_PACK_ID];
}

export function listExtensionPacks(): ExtensionPackSummary[] {
  return Object.values(extensionPacks).map((pack) => ({
    ...pack,
    defaults: {
      extensionSchemaVersion: EXTENSION_SCHEMA_VERSION,
      ...pack.defaults
    }
  }));
}

export function normalizeExtensionSelection(
  input: Partial<Record<keyof ExtensionSelection | "ruleSetId", unknown>> = {},
  packId?: string | null
): ExtensionSelection {
  const pack = getExtensionPack(packId || (typeof input.ruleSetId === "string" ? input.ruleSetId : DEFAULT_EXTENSION_PACK_ID));
  const rawMapId = typeof input.mapId === "string" ? input.mapId : pack.defaults.mapId;
  const rawDiceRuleSetId = typeof input.diceRuleSetId === "string" ? input.diceRuleSetId : pack.defaults.diceRuleSetId;
  const rawVictoryRuleSetId = typeof input.victoryRuleSetId === "string" ? input.victoryRuleSetId : pack.defaults.victoryRuleSetId;
  const rawThemeId = typeof input.themeId === "string" ? input.themeId : pack.defaults.themeId;
  const rawPieceSkinId = typeof input.pieceSkinId === "string" ? input.pieceSkinId : pack.defaults.pieceSkinId;

  return {
    extensionSchemaVersion: EXTENSION_SCHEMA_VERSION,
    mapId: findSupportedMap(rawMapId) ? rawMapId : pack.defaults.mapId,
    diceRuleSetId: findDiceRuleSet(rawDiceRuleSetId) ? rawDiceRuleSetId : pack.defaults.diceRuleSetId,
    victoryRuleSetId: findVictoryRuleSet(rawVictoryRuleSetId) ? rawVictoryRuleSetId : pack.defaults.victoryRuleSetId,
    themeId: findVisualTheme(rawThemeId) ? rawThemeId : pack.defaults.themeId,
    pieceSkinId: findPieceSkin(rawPieceSkinId) ? rawPieceSkinId : pack.defaults.pieceSkinId
  };
}

export function migrateGameConfigExtensions(
  input: Record<string, unknown> | null | undefined,
  fallback: Partial<Record<keyof ExtensionSelection | keyof NetRiskGameModuleSelection | "ruleSetId" | "mapName", unknown>> = {}
): ExtensionAwareGameConfig {
  const source = input && typeof input === "object" ? input : {};
  const requestedPackId = typeof source.ruleSetId === "string"
    ? source.ruleSetId
    : (typeof fallback.ruleSetId === "string" ? fallback.ruleSetId : DEFAULT_EXTENSION_PACK_ID);
  const pack = getExtensionPack(requestedPackId);
  const selection = normalizeExtensionSelection({
    mapId: typeof source.mapId === "string" ? source.mapId : fallback.mapId,
    diceRuleSetId: typeof source.diceRuleSetId === "string" ? source.diceRuleSetId : fallback.diceRuleSetId,
    victoryRuleSetId: typeof source.victoryRuleSetId === "string" ? source.victoryRuleSetId : fallback.victoryRuleSetId,
    themeId: typeof source.themeId === "string" ? source.themeId : fallback.themeId,
    pieceSkinId: typeof source.pieceSkinId === "string" ? source.pieceSkinId : fallback.pieceSkinId
  }, requestedPackId);
  const mapName = typeof source.mapName === "string"
    ? source.mapName
    : (typeof fallback.mapName === "string" ? fallback.mapName : readableMapName(selection.mapId));
  const moduleSelection = normalizeNetRiskGameModuleSelection({
    moduleSchemaVersion: typeof source.moduleSchemaVersion === "number"
      ? source.moduleSchemaVersion
      : (typeof fallback.moduleSchemaVersion === "number" ? fallback.moduleSchemaVersion : NETRISK_MODULE_SCHEMA_VERSION),
    activeModules: Array.isArray(source.activeModules)
      ? source.activeModules as NetRiskModuleReference[]
      : (Array.isArray(fallback.activeModules) ? fallback.activeModules as NetRiskModuleReference[] : undefined),
    contentProfileId: typeof source.contentProfileId === "string"
      ? source.contentProfileId
      : (typeof fallback.contentProfileId === "string" ? fallback.contentProfileId : null),
    gameplayProfileId: typeof source.gameplayProfileId === "string"
      ? source.gameplayProfileId
      : (typeof fallback.gameplayProfileId === "string" ? fallback.gameplayProfileId : null),
    uiProfileId: typeof source.uiProfileId === "string"
      ? source.uiProfileId
      : (typeof fallback.uiProfileId === "string" ? fallback.uiProfileId : null)
  });

  return {
    ...source,
    extensionSchemaVersion: EXTENSION_SCHEMA_VERSION,
    moduleSchemaVersion: moduleSelection.moduleSchemaVersion,
    ruleSetId: pack.id,
    ruleSetName: typeof source.ruleSetName === "string" ? source.ruleSetName : pack.name,
    mapId: selection.mapId,
    mapName,
    diceRuleSetId: selection.diceRuleSetId,
    victoryRuleSetId: selection.victoryRuleSetId,
    themeId: selection.themeId,
    pieceSkinId: selection.pieceSkinId,
    activeModules: moduleSelection.activeModules,
    contentProfileId: moduleSelection.contentProfileId || null,
    gameplayProfileId: moduleSelection.gameplayProfileId || null,
    uiProfileId: moduleSelection.uiProfileId || null,
    name: typeof source.name === "string" ? source.name : undefined,
    turnTimeoutHours: typeof source.turnTimeoutHours === "number" ? source.turnTimeoutHours : null,
    totalPlayers: typeof source.totalPlayers === "number" ? source.totalPlayers : undefined,
    players: Array.isArray(source.players) ? source.players : undefined
  };
}

export function migrateGameStateExtensions<T extends ExtensionGameStateLike>(state: T): T & { gameConfig: ExtensionAwareGameConfig } {
  if (!state || typeof state !== "object") {
    return state as T & { gameConfig: ExtensionAwareGameConfig };
  }

  const migratedConfig = migrateGameConfigExtensions(state.gameConfig || null, {
    mapId: typeof state.mapId === "string" ? state.mapId : undefined,
    mapName: typeof state.mapName === "string" ? state.mapName : undefined,
    diceRuleSetId: typeof state.diceRuleSetId === "string" ? state.diceRuleSetId : undefined
  });

  (state as T & { gameConfig: ExtensionAwareGameConfig }).gameConfig = migratedConfig;

  if (typeof state.mapId !== "string" || !findSupportedMap(state.mapId)) {
    (state as T & { mapId: string }).mapId = migratedConfig.mapId;
  }

  if (typeof state.mapName !== "string" || !state.mapName) {
    (state as T & { mapName: string | null }).mapName = migratedConfig.mapName || readableMapName(migratedConfig.mapId);
  }

  if (typeof state.diceRuleSetId !== "string" || !findDiceRuleSet(state.diceRuleSetId)) {
    (state as T & { diceRuleSetId: string }).diceRuleSetId = migratedConfig.diceRuleSetId;
  }

  return state as T & { gameConfig: ExtensionAwareGameConfig };
}

export function listSupportedThemeIds(): string[] {
  return listVisualThemes().map((theme) => theme.id);
}

export function resolveStoredThemeId(themeId: unknown): string {
  return typeof themeId === "string" && findVisualTheme(themeId) ? themeId : DEFAULT_THEME_ID;
}

export function resolveThemeOptions() {
  return listVisualThemes();
}

export function resolvePieceSkinOptions() {
  return listPieceSkins();
}

export function resolveVictoryRuleOptions() {
  return listVictoryRuleSets();
}

export function resolveMapDefinition(mapId: string | null | undefined): MapDefinition {
  const selected = findSupportedMap(mapId || "") || findSupportedMap(getExtensionPack().defaults.mapId);
  return {
    id: selected?.id || getExtensionPack().defaults.mapId,
    name: selected?.name || readableMapName(getExtensionPack().defaults.mapId) || "Classic Mini"
  };
}

export function resolveDiceRuleDefinition(ruleSetId: string | null | undefined) {
  return getDiceRuleSet(ruleSetId || getExtensionPack().defaults.diceRuleSetId);
}
