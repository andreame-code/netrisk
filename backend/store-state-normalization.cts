const { migrateGameStateExtensions } = require("../shared/extensions.cjs");
const { findCoreBaseSupportedMap } = require("../shared/core-base-catalog.cjs");

type StoreStateRecord = {
  gameConfig?: Record<string, unknown> | null;
  contentPackId?: unknown;
  mapId?: unknown;
  mapName?: unknown;
  diceRuleSetId?: unknown;
  victoryRuleSetId?: unknown;
  pieceSetId?: unknown;
};

const PERSISTED_GAME_CONFIG_KEYS = Object.freeze([
  "name",
  "contentPackId",
  "pieceSetId",
  "pieceSetName",
  "pieceSetPalette",
  "ruleSetId",
  "ruleSetName",
  "mapId",
  "mapName",
  "diceRuleSetId",
  "diceRuleSetName",
  "diceRuleSetAttackerMaxDice",
  "diceRuleSetDefenderMaxDice",
  "diceRuleSetAttackerMustLeaveOneArmyBehind",
  "diceRuleSetDefenderWinsTies",
  "victoryRuleSetId",
  "themeId",
  "pieceSkinId",
  "moduleSchemaVersion",
  "activeModules",
  "gamePresetId",
  "contentProfileId",
  "gameplayProfileId",
  "uiProfileId",
  "gameplayEffects",
  "scenarioSetup",
  "turnTimeoutHours",
  "totalPlayers",
  "players"
]);

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function copyRootValueToGameConfig(
  normalizedConfig: Record<string, unknown>,
  rawConfig: Record<string, unknown> | null,
  rawState: StoreStateRecord,
  key: "contentPackId" | "pieceSetId" | "victoryRuleSetId"
) {
  const rawConfigValue = rawConfig ? rawConfig[key] : undefined;
  if (typeof rawConfigValue === "string" && rawConfigValue.trim()) {
    return;
  }

  const rawStateValue = rawState[key];
  if (typeof rawStateValue === "string" && rawStateValue.trim()) {
    normalizedConfig[key] = rawStateValue;
  }
}

function persistMapSelectionIntoGameConfig(
  normalizedConfig: Record<string, unknown> | null,
  rawConfig: Record<string, unknown> | null,
  rawState: StoreStateRecord
) {
  if (!normalizedConfig) {
    return;
  }

  const rawConfigMapId =
    typeof rawConfig?.mapId === "string" && rawConfig.mapId.trim() ? rawConfig.mapId : null;
  const rawStateMapId =
    typeof rawState.mapId === "string" && rawState.mapId.trim() ? rawState.mapId : null;
  const persistedMapId = rawConfigMapId || rawStateMapId;

  if (!persistedMapId) {
    return;
  }

  normalizedConfig.mapId = persistedMapId;

  const rawConfigMapName =
    typeof rawConfig?.mapName === "string" && rawConfig.mapName.trim() ? rawConfig.mapName : null;
  const rawStateMapName =
    typeof rawState.mapName === "string" && rawState.mapName.trim() ? rawState.mapName : null;
  const persistedMapName = rawConfigMapName || rawStateMapName;

  if (persistedMapName) {
    normalizedConfig.mapName = persistedMapName;
    return;
  }

  if (!findCoreBaseSupportedMap(persistedMapId)) {
    normalizedConfig.mapName = persistedMapId;
  }
}

export function normalizeStoreStateRecord<T extends StoreStateRecord>(
  state: T,
  persistedState?: StoreStateRecord | null
): T {
  const rawState =
    persistedState && typeof persistedState === "object"
      ? persistedState
      : (state as StoreStateRecord);
  const normalizedState = migrateGameStateExtensions(state) as T & StoreStateRecord;
  const rawConfig =
    rawState.gameConfig && typeof rawState.gameConfig === "object" ? rawState.gameConfig : null;
  const normalizedConfig =
    normalizedState.gameConfig && typeof normalizedState.gameConfig === "object"
      ? normalizedState.gameConfig
      : null;

  if (rawConfig && normalizedConfig) {
    PERSISTED_GAME_CONFIG_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(rawConfig, key)) {
        return;
      }

      const value = rawConfig[key];
      if (value == null) {
        return;
      }

      normalizedConfig[key] = cloneValue(value);
    });
  }

  if (normalizedConfig) {
    copyRootValueToGameConfig(normalizedConfig, rawConfig, rawState, "contentPackId");
    copyRootValueToGameConfig(normalizedConfig, rawConfig, rawState, "pieceSetId");
    copyRootValueToGameConfig(normalizedConfig, rawConfig, rawState, "victoryRuleSetId");
  }

  persistMapSelectionIntoGameConfig(normalizedConfig, rawConfig, rawState);

  if (typeof rawState.mapId === "string" && rawState.mapId.trim()) {
    normalizedState.mapId = rawState.mapId;
  }

  if (typeof rawState.mapName === "string" && rawState.mapName.trim()) {
    normalizedState.mapName = rawState.mapName;
  }

  if (typeof rawState.diceRuleSetId === "string" && rawState.diceRuleSetId.trim()) {
    normalizedState.diceRuleSetId = rawState.diceRuleSetId;
  }

  return normalizedState as T;
}
