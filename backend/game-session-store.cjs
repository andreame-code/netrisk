const path = require("path");
const crypto = require("crypto");
const { findSupportedMap } = require("../shared/maps/index.cjs");
const { createDatastore } = require("./datastore.cjs");
const { chainMaybe, mapMaybe } = require("./maybe-async.cjs");

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readableMapName(mapId) {
  const map = findSupportedMap(mapId);
  return map ? map.name : (mapId || null);
}

function normalizeGameName(name, fallbackIndex) {
  if (name == null) {
    return `Partita ${fallbackIndex}`;
  }

  const normalized = String(name).trim().slice(0, 80);
  if (!normalized) {
    throw new Error("Il nome della partita non puo essere vuoto.");
  }

  return normalized;
}

function summarizeGame(entry) {
  const config = entry.state && entry.state.gameConfig ? entry.state.gameConfig : null;
  const configuredPlayers = Array.isArray(config && config.players) ? config.players : [];
  const totalPlayers = Number.isInteger(config && config.totalPlayers) ? config.totalPlayers : configuredPlayers.length;

  return {
    id: entry.id,
    name: entry.name,
    version: Number.isInteger(entry.version) && entry.version > 0 ? entry.version : 1,
    creatorUserId: entry.creatorUserId || null,
    phase: entry.state && entry.state.phase ? entry.state.phase : "lobby",
    playerCount: Array.isArray(entry.state && entry.state.players) ? entry.state.players.length : 0,
    mapId: config && config.mapId ? config.mapId : null,
    mapName: config ? (config.mapName || readableMapName(config.mapId)) : null,
    diceRuleSetId: config && config.diceRuleSetId ? config.diceRuleSetId : null,
    victoryRuleId: config && config.victoryRuleId ? config.victoryRuleId : null,
    gameModeId: entry.state && entry.state.gameModeId ? entry.state.gameModeId : null,
    communityId: entry.state && entry.state.communityId ? entry.state.communityId : null,
    totalPlayers: totalPlayers || null,
    aiCount: configuredPlayers.filter((player) => player.type === "ai").length,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function createGameSessionStore(options = {}) {
  const datastore = options.datastore || createDatastore({
    dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
    legacyGamesFile: options.dataFile || path.join(__dirname, "..", "data", "games.json"),
    legacyUsersFile: options.usersFile || options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    legacySessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
  });

  function listGames() {
    return mapMaybe(datastore.listGames(), (games) => games
      .slice()
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map(summarizeGame));
  }

  function createGame(initialState, input = {}) {
    if (!initialState || typeof initialState !== "object") {
      throw new Error("La creazione della partita richiede uno stato iniziale valido.");
    }

    return chainMaybe(datastore.listGames(), (games) => {
      const timestamp = new Date().toISOString();
      const entry = {
        id: crypto.randomBytes(8).toString("hex"),
        name: normalizeGameName(input.name, games.length + 1),
        version: 1,
        creatorUserId: input.creatorUserId || null,
        state: safeClone(initialState),
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return chainMaybe(datastore.createGame(entry), (created) =>
        mapMaybe(datastore.setActiveGameId(created.id), () => ({
          game: summarizeGame(created),
          state: safeClone(created.state)
        })));
    });
  }

  function setActiveGame(gameId) {
    if (!gameId) {
      throw new Error("Impostare la partita attiva richiede un game id valido.");
    }

    return chainMaybe(datastore.findGameById(gameId), (entry) => {
      if (!entry) {
        throw new Error(`Partita "${gameId}" non trovata.`);
      }

      return mapMaybe(datastore.setActiveGameId(gameId), () => summarizeGame(entry));
    });
  }

  function getGame(gameId) {
    if (!gameId) {
      throw new Error("Leggere una partita richiede un game id valido.");
    }

    return mapMaybe(datastore.findGameById(gameId), (entry) => {
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

  function openGame(gameId) {
    if (!gameId) {
      throw new Error("Aprire una partita richiede un game id valido.");
    }

    return chainMaybe(datastore.findGameById(gameId), (entry) => {
      if (!entry) {
        throw new Error(`Partita "${gameId}" non trovata.`);
      }

      return mapMaybe(datastore.setActiveGameId(gameId), () => ({
        game: summarizeGame(entry),
        state: safeClone(entry.state)
      }));
    });
  }

  function saveGame(gameId, state, expectedVersion) {
    if (!gameId) {
      throw new Error("Il salvataggio richiede un game id valido.");
    }

    if (!state || typeof state !== "object") {
      throw new Error("Il salvataggio richiede uno stato partita valido.");
    }

    if (expectedVersion != null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
      throw new Error("Il salvataggio richiede una expectedVersion valida.");
    }

    return chainMaybe(datastore.findGameById(gameId), (entry) => {
      if (!entry) {
        throw new Error(`Partita "${gameId}" non trovata.`);
      }

      const currentVersion = Number.isInteger(entry.version) && entry.version > 0 ? entry.version : 1;
      entry.version = currentVersion;

      if (expectedVersion != null && expectedVersion !== currentVersion) {
        const conflict = new Error("La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.");
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

  function ensureActiveGame(createInitialState) {
    return chainMaybe(datastore.listGames(), (games) =>
      chainMaybe(datastore.getActiveGameId(), (activeGameId) => {
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
