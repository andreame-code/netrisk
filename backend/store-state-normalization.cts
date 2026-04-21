const { migrateGameStateExtensions } = require("../shared/extensions.cjs");

type StoreStateRecord = {
  gameConfig?: Record<string, unknown> | null;
  mapId?: unknown;
  mapName?: unknown;
  diceRuleSetId?: unknown;
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
