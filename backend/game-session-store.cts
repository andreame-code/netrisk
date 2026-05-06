const path = require("path");
const crypto = require("crypto");
const { createDatastore } = require("./datastore.cjs");
const { chainMaybe, mapMaybe } = require("./maybe-async.cjs");
const { normalizeStoreStateRecord } = require("./store-state-normalization.cjs");
const { findCoreBaseSupportedMap } = require("../shared/core-base-catalog.cjs");

interface GamePlayerConfig {
  type?: string;
}

interface GameModuleReference {
  id?: string;
  version?: string;
}

interface GameConfig {
  players?: GamePlayerConfig[];
  totalPlayers?: number;
  contentPackId?: string | null;
  mapId?: string | null;
  mapName?: string | null;
  diceRuleSetId?: string | null;
  victoryRuleSetId?: string | null;
  pieceSetId?: string | null;
  activeModules?: GameModuleReference[] | null;
  gamePresetId?: string | null;
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
}

interface GameStateRecord {
  phase?: string;
  players?: Array<Record<string, unknown>>;
  currentTurnIndex?: number;
  gameConfig?: GameConfig | null;
  [key: string]: unknown;
}

interface GameEntry {
  id: string;
  name: string;
  version?: number;
  creatorUserId?: string | null;
  state: GameStateRecord;
  createdAt: string;
  updatedAt: string;
}

interface GameSummary {
  id: string;
  name: string;
  version: number;
  creatorUserId: string | null;
  phase: string;
  currentPlayerId: string | null;
  playerCount: number;
  contentPackId: string | null;
  mapId: string | null;
  mapName: string | null;
  diceRuleSetId: string | null;
  totalPlayers: number | null;
  aiCount: number;
  activeModules: Array<{ id: string; version: string }>;
  gamePresetId: string | null;
  contentProfileId: string | null;
  gameplayProfileId: string | null;
  uiProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GameSessionStoreOptions {
  datastore?: {
    listGames(): GameEntry[] | Promise<GameEntry[]>;
    createGame(entry: GameEntry): GameEntry | Promise<GameEntry>;
    setActiveGameId(gameId: string): void | Promise<void>;
    findGameById(gameId: string): GameEntry | null | Promise<GameEntry | null>;
    getActiveGameId(): string | null | Promise<string | null>;
    updateGame(entry: GameEntry): GameEntry | Promise<GameEntry>;
    deleteGame?(gameId: string): void | Promise<void>;
  };
  dbFile?: string;
  dataFile?: string;
  usersFile?: string;
  sessionsFile?: string;
  resolveMapName?: (mapId: string | null | undefined) => string | null;
}

type VersionConflictError = Error & {
  code: string;
  currentVersion: number;
  currentState: GameStateRecord;
  game: GameSummary;
};

function safeClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readableMapName(mapId: string | null | undefined): string | null {
  if (!mapId) {
    return null;
  }

  return findCoreBaseSupportedMap(mapId)?.name || mapId;
}

function normalizeStateRecord<T extends GameStateRecord>(
  state: T,
  persistedState?: GameStateRecord | null
): T {
  return normalizeStoreStateRecord(state, persistedState) as T;
}

function normalizeActiveModules(
  activeModules: GameModuleReference[] | null | undefined
): Array<{ id: string; version: string }> {
  if (!Array.isArray(activeModules)) {
    return [];
  }

  return activeModules
    .filter((entry): entry is GameModuleReference =>
      Boolean(entry && typeof entry.id === "string" && typeof entry.version === "string")
    )
    .map((entry) => ({
      id: String(entry.id),
      version: String(entry.version)
    }));
}

function normalizeGameName(name: unknown, fallbackIndex: number): string {
  if (name == null) {
    return `Partita ${fallbackIndex}`;
  }

  const normalized = String(name).trim().slice(0, 80);
  if (!normalized) {
    throw new Error("Il nome della partita non puo essere vuoto.");
  }

  if (!/^[\p{L}\p{N}\s\-_'.,!?()]+$/u.test(normalized)) {
    throw new Error("Il nome della partita contiene caratteri non consentiti.");
  }

  return normalized;
}

function persistedMapName(entry: GameEntry): string | null {
  const configMapName = entry?.state?.gameConfig?.mapName;
  if (typeof configMapName === "string" && configMapName.trim()) {
    return configMapName;
  }

  const stateMapName = entry?.state?.mapName;
  if (typeof stateMapName === "string" && stateMapName.trim()) {
    return stateMapName;
  }

  return null;
}

function summarizeGameWithMapName(
  entry: GameEntry,
  resolveMapName: (mapId: string | null | undefined) => string | null
): GameSummary {
  const storedMapName = persistedMapName(entry);
  const state = normalizeStateRecord(safeClone(entry.state || {}), entry.state || null);
  const config = state.gameConfig || null;
  const resolvedMapName = config
    ? resolveMapName(config.mapId) || readableMapName(config.mapId)
    : null;
  const configuredPlayers: GamePlayerConfig[] = Array.isArray(config?.players)
    ? config.players
    : [];
  const totalPlayers = Number.isInteger(config?.totalPlayers)
    ? Number(config?.totalPlayers)
    : configuredPlayers.length;
  const version =
    Number.isInteger(entry.version) && Number(entry.version) > 0 ? Number(entry.version) : 1;
  const activeModules = normalizeActiveModules(config?.activeModules);
  const currentTurnPlayer =
    state.phase === "active" &&
    Array.isArray(state.players) &&
    Number.isInteger(state.currentTurnIndex)
      ? state.players[Number(state.currentTurnIndex)]
      : null;
  const currentPlayerId =
    typeof currentTurnPlayer?.id === "string" && currentTurnPlayer.id.trim()
      ? currentTurnPlayer.id
      : null;

  return {
    id: entry.id,
    name: entry.name,
    version,
    creatorUserId: entry.creatorUserId || null,
    phase: state?.phase || "lobby",
    currentPlayerId,
    playerCount: Array.isArray(state?.players) ? state.players.length : 0,
    contentPackId: config?.contentPackId || null,
    mapId: config?.mapId || null,
    mapName: storedMapName ?? resolvedMapName,
    diceRuleSetId: config?.diceRuleSetId || null,
    totalPlayers: totalPlayers || null,
    aiCount: configuredPlayers.filter((player) => player.type === "ai").length,
    activeModules,
    gamePresetId: typeof config?.gamePresetId === "string" ? config.gamePresetId : null,
    contentProfileId: typeof config?.contentProfileId === "string" ? config.contentProfileId : null,
    gameplayProfileId:
      typeof config?.gameplayProfileId === "string" ? config.gameplayProfileId : null,
    uiProfileId: typeof config?.uiProfileId === "string" ? config.uiProfileId : null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function createGameSessionStore(options: GameSessionStoreOptions = {}) {
  const datastore = (options.datastore ||
    createDatastore({
      dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
      legacyGamesFile: options.dataFile || path.join(__dirname, "..", "data", "games.json"),
      legacyUsersFile:
        options.usersFile || options.dataFile || path.join(__dirname, "..", "data", "users.json"),
      legacySessionsFile:
        options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
    })) as NonNullable<GameSessionStoreOptions["datastore"]>;
  const resolveMapName =
    typeof options.resolveMapName === "function" ? options.resolveMapName : readableMapName;

  function listGames() {
    return mapMaybe(datastore.listGames(), (games: GameEntry[]) =>
      games
        .slice()
        .sort((left: GameEntry, right: GameEntry) =>
          String(right.updatedAt).localeCompare(String(left.updatedAt))
        )
        .map((entry) => summarizeGameWithMapName(entry, resolveMapName))
    );
  }

  function createGame(
    initialState: GameStateRecord,
    input: { name?: unknown; creatorUserId?: string | null } = {}
  ) {
    if (!initialState || typeof initialState !== "object") {
      throw new Error("La creazione della partita richiede uno stato iniziale valido.");
    }

    const normalizedInitialState = normalizeStateRecord(safeClone(initialState), initialState);
    return chainMaybe(datastore.listGames(), (games: GameEntry[]) => {
      const timestamp = new Date().toISOString();
      const entry: GameEntry = {
        id: crypto.randomBytes(8).toString("hex"),
        name: normalizeGameName(input.name, games.length + 1),
        version: 1,
        creatorUserId: input.creatorUserId || null,
        state: normalizedInitialState,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return chainMaybe(datastore.createGame(entry), (created: GameEntry) =>
        mapMaybe(datastore.setActiveGameId(created.id), () => ({
          game: summarizeGameWithMapName(created, resolveMapName),
          state: normalizeStateRecord(safeClone(created.state), created.state)
        }))
      );
    });
  }

  function setActiveGame(gameId: string) {
    if (!gameId) {
      throw new Error("Impostare la partita attiva richiede un game id valido.");
    }

    return chainMaybe(datastore.findGameById(gameId), (entry: GameEntry | null) => {
      if (!entry) {
        throw new Error(`Partita "${gameId}" non trovata.`);
      }

      return mapMaybe(datastore.setActiveGameId(gameId), () =>
        summarizeGameWithMapName(entry, resolveMapName)
      );
    });
  }

  function getGame(gameId: string) {
    if (!gameId) {
      throw new Error("Leggere una partita richiede un game id valido.");
    }

    return mapMaybe(datastore.findGameById(gameId), (entry: GameEntry | null) => {
      if (!entry) {
        throw new Error(`Partita "${gameId}" non trovata.`);
      }

      return {
        game: {
          ...summarizeGameWithMapName(entry, resolveMapName),
          creatorUserId: entry.creatorUserId || null
        },
        state: normalizeStateRecord(safeClone(entry.state), entry.state)
      };
    });
  }

  function openGame(gameId: string) {
    if (!gameId) {
      throw new Error("Aprire una partita richiede un game id valido.");
    }

    return chainMaybe(datastore.findGameById(gameId), (entry: GameEntry | null) => {
      if (!entry) {
        throw new Error(`Partita "${gameId}" non trovata.`);
      }

      return mapMaybe(datastore.setActiveGameId(gameId), () => ({
        game: summarizeGameWithMapName(entry, resolveMapName),
        state: normalizeStateRecord(safeClone(entry.state), entry.state)
      }));
    });
  }

  function saveGame(gameId: string, state: GameStateRecord, expectedVersion?: number | null) {
    if (!gameId) {
      throw new Error("Il salvataggio richiede un game id valido.");
    }

    if (!state || typeof state !== "object") {
      throw new Error("Il salvataggio richiede uno stato partita valido.");
    }

    if (expectedVersion != null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
      throw new Error("Il salvataggio richiede una expectedVersion valida.");
    }

    return chainMaybe(datastore.findGameById(gameId), (entry: GameEntry | null) => {
      if (!entry) {
        throw new Error(`Partita "${gameId}" non trovata.`);
      }

      const currentVersion =
        Number.isInteger(entry.version) && Number(entry.version) > 0 ? Number(entry.version) : 1;
      entry.version = currentVersion;

      if (expectedVersion != null && expectedVersion !== currentVersion) {
        const conflict = new Error(
          "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente."
        ) as VersionConflictError;
        conflict.code = "VERSION_CONFLICT";
        conflict.currentVersion = currentVersion;
        conflict.currentState = safeClone(entry.state);
        conflict.game = summarizeGameWithMapName(entry, resolveMapName);
        throw conflict;
      }

      entry.state = normalizeStateRecord(safeClone(state), state);
      entry.version = currentVersion + 1;
      entry.updatedAt = new Date().toISOString();
      return mapMaybe(datastore.updateGame(entry), (updatedEntry: GameEntry) =>
        summarizeGameWithMapName(updatedEntry, resolveMapName)
      );
    });
  }

  function ensureActiveGame(createInitialState: () => GameStateRecord) {
    return chainMaybe(datastore.listGames(), (games: GameEntry[]) =>
      chainMaybe(datastore.getActiveGameId(), (activeGameId: string | null) => {
        const preferredId =
          activeGameId && games.some((game) => game.id === activeGameId) ? activeGameId : null;

        if (preferredId) {
          return openGame(preferredId);
        }

        if (games.length > 0) {
          return openGame(games[0].id);
        }

        return createGame(createInitialState(), { name: "Partita 1" });
      })
    );
  }

  return {
    datastore,
    createGame,
    ensureActiveGame,
    getGame,
    listGames,
    openGame,
    saveGame,
    setActiveGame
  };
}

module.exports = {
  createGameSessionStore
};
