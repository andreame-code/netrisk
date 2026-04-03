const path = require("path");
const crypto = require("crypto");
const { findSupportedMap } = require("../shared/maps/index.cjs");
const { readJsonFile, writeJsonFile } = require("./json-file-store.cjs");

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readDatabase(filePath) {
  const parsed = readJsonFile(filePath, { games: [], activeGameId: null }, (value) => Boolean(value) && typeof value === "object");
  return {
    games: Array.isArray(parsed.games) ? parsed.games : [],
    activeGameId: parsed.activeGameId || null
  };
}

function writeDatabase(filePath, database) {
  writeJsonFile(filePath, database);
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
    phase: entry.state && entry.state.phase ? entry.state.phase : "lobby",
    playerCount: Array.isArray(entry.state && entry.state.players) ? entry.state.players.length : 0,
    mapId: config && config.mapId ? config.mapId : null,
    mapName: config ? (config.mapName || readableMapName(config.mapId)) : null,
    diceRuleSetId: config && config.diceRuleSetId ? config.diceRuleSetId : null,
    totalPlayers: totalPlayers || null,
    aiCount: configuredPlayers.filter((player) => player.type === "ai").length,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function createGameSessionStore(options = {}) {
  const dataFile = options.dataFile || path.join(__dirname, "..", "data", "games.json");

  function listGames() {
    const database = readDatabase(dataFile);
    return database.games
      .slice()
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map(summarizeGame);
  }

  function createGame(initialState, input = {}) {
    if (!initialState || typeof initialState !== "object") {
      throw new Error("La creazione della partita richiede uno stato iniziale valido.");
    }

    const database = readDatabase(dataFile);
    const timestamp = new Date().toISOString();
    const entry = {
      id: crypto.randomBytes(8).toString("hex"),
      name: normalizeGameName(input.name, database.games.length + 1),
      version: 1,
      creatorUserId: input.creatorUserId || null,
      state: safeClone(initialState),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    database.games.push(entry);
    database.activeGameId = entry.id;
    writeDatabase(dataFile, database);
    return { game: summarizeGame(entry), state: safeClone(entry.state) };
  }

  function setActiveGame(gameId) {
    if (!gameId) {
      throw new Error("Impostare la partita attiva richiede un game id valido.");
    }

    const database = readDatabase(dataFile);
    const entry = database.games.find((game) => game.id === gameId);
    if (!entry) {
      throw new Error(`Partita "${gameId}" non trovata.`);
    }

    database.activeGameId = gameId;
    writeDatabase(dataFile, database);
    return summarizeGame(entry);
  }

  function getGame(gameId) {
    if (!gameId) {
      throw new Error("Leggere una partita richiede un game id valido.");
    }

    const database = readDatabase(dataFile);
    const entry = database.games.find((game) => game.id === gameId);
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
  }

  function openGame(gameId) {
    if (!gameId) {
      throw new Error("Aprire una partita richiede un game id valido.");
    }

    const database = readDatabase(dataFile);
    const entry = database.games.find((game) => game.id === gameId);
    if (!entry) {
      throw new Error(`Partita "${gameId}" non trovata.`);
    }

    database.activeGameId = gameId;
    writeDatabase(dataFile, database);
    return { game: summarizeGame(entry), state: safeClone(entry.state) };
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

    const database = readDatabase(dataFile);
    const entry = database.games.find((game) => game.id === gameId);
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
    writeDatabase(dataFile, database);
    return summarizeGame(entry);
  }

  function ensureActiveGame(createInitialState) {
    const database = readDatabase(dataFile);
    const preferredId = database.activeGameId && database.games.some((game) => game.id === database.activeGameId)
      ? database.activeGameId
      : null;

    if (preferredId) {
      return openGame(preferredId);
    }

    const games = listGames();
    if (games.length > 0) {
      return openGame(games[0].id);
    }

    return createGame(createInitialState(), { name: "Partita 1" });
  }

  return {
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


