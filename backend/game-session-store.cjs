const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readDatabase(filePath) {
  ensureDirectory(filePath);
  if (!fs.existsSync(filePath)) {
    return { games: [] };
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return { games: [] };
  }

  const parsed = JSON.parse(raw);
  return {
    games: Array.isArray(parsed.games) ? parsed.games : []
  };
}

function writeDatabase(filePath, database) {
  ensureDirectory(filePath);
  fs.writeFileSync(filePath, JSON.stringify(database, null, 2) + "\n");
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
  return {
    id: entry.id,
    name: entry.name,
    phase: entry.state && entry.state.phase ? entry.state.phase : "lobby",
    playerCount: Array.isArray(entry.state && entry.state.players) ? entry.state.players.length : 0,
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
      state: safeClone(initialState),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    database.games.push(entry);
    writeDatabase(dataFile, database);
    return { game: summarizeGame(entry), state: safeClone(entry.state) };
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

    return { game: summarizeGame(entry), state: safeClone(entry.state) };
  }

  function saveGame(gameId, state) {
    if (!gameId) {
      throw new Error("Il salvataggio richiede un game id valido.");
    }

    if (!state || typeof state !== "object") {
      throw new Error("Il salvataggio richiede uno stato partita valido.");
    }

    const database = readDatabase(dataFile);
    const entry = database.games.find((game) => game.id === gameId);
    if (!entry) {
      throw new Error(`Partita "${gameId}" non trovata.`);
    }

    entry.state = safeClone(state);
    entry.updatedAt = new Date().toISOString();
    writeDatabase(dataFile, database);
    return summarizeGame(entry);
  }

  function ensureActiveGame(createInitialState) {
    const games = listGames();
    if (games.length > 0) {
      const firstGame = openGame(games[0].id);
      return { game: firstGame.game, state: firstGame.state };
    }

    return createGame(createInitialState(), { name: "Partita 1" });
  }

  return {
    createGame,
    ensureActiveGame,
    listGames,
    openGame,
    saveGame
  };
}

module.exports = {
  createGameSessionStore
};
