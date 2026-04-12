const path = require("path");
const crypto = require("crypto");
const { findSupportedMap } = require("../shared/maps/index.cjs");
const { createDatastore } = require("./datastore.cjs");
const { chainMaybe, mapMaybe } = require("./maybe-async.cjs");

interface GamePlayerConfig {
  type?: string;
}

interface GameConfig {
  players?: GamePlayerConfig[];
  totalPlayers?: number;
  mapId?: string | null;
  mapName?: string | null;
  diceRuleSetId?: string | null;
}

interface GameStateRecord {
  phase?: string;
  players?: Array<Record<string, unknown>>;
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
  playerCount: number;
  mapId: string | null;
  mapName: string | null;
  diceRuleSetId: string | null;
  totalPlayers: number | null;
  aiCount: number;
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
  };
  dbFile?: string;
  dataFile?: string;
  usersFile?: string;
  sessionsFile?: string;
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
  const map = findSupportedMap(mapId);
  return map ? map.name : (mapId || null);
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

function summarizeGame(entry: GameEntry): GameSummary {
  const config = entry.state?.gameConfig || null;
  const configuredPlayers: GamePlayerConfig[] = Array.isArray(config?.players) ? config.players : [];
  const totalPlayers = Number.isInteger(config?.totalPlayers) ? Number(config?.totalPlayers) : configuredPlayers.length;
  const version = Number.isInteger(entry.version) && Number(entry.version) > 0 ? Number(entry.version) : 1;

  return {
    id: entry.id,
    name: entry.name,
    version,
    creatorUserId: entry.creatorUserId || null,
    phase: entry.state?.phase || "lobby",
    playerCount: Array.isArray(entry.state?.players) ? entry.state.players.length : 0,
    mapId: config?.mapId || null,
    mapName: config ? (config.mapName || readableMapName(config.mapId)) : null,
    diceRuleSetId: config?.diceRuleSetId || null,
    totalPlayers: totalPlayers || null,
    aiCount: configuredPlayers.filter((player) => player.type === "ai").length,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function createGameSessionStore(options: GameSessionStoreOptions = {}) {
  const datastore = (options.datastore || createDatastore({
    dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
    legacyGamesFile: options.dataFile || path.join(__dirname, "..", "data", "games.json"),
    legacyUsersFile: options.usersFile || options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    legacySessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
  })) as NonNullable<GameSessionStoreOptions["datastore"]>;

  function listGames() {
    return mapMaybe(datastore.listGames(), (games: GameEntry[]) => games
      .slice()
      .sort((left: GameEntry, right: GameEntry) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map(summarizeGame));
  }

  function createGame(initialState: GameStateRecord, input: { name?: unknown; creatorUserId?: string | null } = {}) {
    if (!initialState || typeof initialState !== "object") {
      throw new Error("La creazione della partita richiede uno stato iniziale valido.");
    }

    return chainMaybe(datastore.listGames(), (games: GameEntry[]) => {
      const timestamp = new Date().toISOString();
      const entry: GameEntry = {
        id: crypto.randomBytes(8).toString("hex"),
        name: normalizeGameName(input.name, games.length + 1),
        version: 1,
        creatorUserId: input.creatorUserId || null,
        state: safeClone(initialState),
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return chainMaybe(datastore.createGame(entry), (created: GameEntry) =>
        mapMaybe(datastore.setActiveGameId(created.id), () => ({
          game: summarizeGame(created),
          state: safeClone(created.state)
        })));
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

      return mapMaybe(datastore.setActiveGameId(gameId), () => summarizeGame(entry));
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
          ...summarizeGame(entry),
          creatorUserId: entry.creatorUserId || null
        },
        state: safeClone(entry.state)
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
        game: summarizeGame(entry),
        state: safeClone(entry.state)
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

      const currentVersion = Number.isInteger(entry.version) && Number(entry.version) > 0 ? Number(entry.version) : 1;
      entry.version = currentVersion;

      if (expectedVersion != null && expectedVersion !== currentVersion) {
        const conflict = new Error("La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.") as VersionConflictError;
        conflict.code = "VERSION_CONFLICT";
        conflict.currentVersion = currentVersion;
        conflict.currentState = safeClone(entry.state);
        conflict.game = summarizeGame(entry);
        throw conflict;
      }

      entry.state = safeClone(state);
      entry.version = currentVersion + 1;
      entry.updatedAt = new Date().toISOString();
      return mapMaybe(datastore.updateGame(entry), summarizeGame);
    });
  }

  function ensureActiveGame(createInitialState: () => GameStateRecord) {
    return chainMaybe(datastore.listGames(), (games: GameEntry[]) =>
      chainMaybe(datastore.getActiveGameId(), (activeGameId: string | null) => {
        const preferredId = activeGameId && games.some((game) => game.id === activeGameId)
          ? activeGameId
          : null;

        if (preferredId) {
          return openGame(preferredId);
        }

        if (games.length > 0) {
          return openGame(games[0].id);
        }

        return createGame(createInitialState(), { name: "Partita 1" });
      }));
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
