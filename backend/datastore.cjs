const fs = require("fs");
const path = require("path");
const { DatabaseSync, backup } = require("node:sqlite");
const { readJsonFile } = require("./json-file-store.cjs");
const { createSupabaseDatastore } = require("./datastore-supabase.cjs");

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseJson(value, fallbackValue) {
  if (value == null || value === "") {
    return fallbackValue;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
}

function normalizeUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    credentials: parseJson(row.credentials_json, {}),
    role: row.role || "user",
    profile: parseJson(row.profile_json, {}),
    createdAt: row.created_at
  };
}

function normalizeGame(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    version: Number.isInteger(row.version) ? row.version : 1,
    creatorUserId: row.creator_user_id || null,
    state: parseJson(row.state_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createDatastore(options = {}) {
  const requestedDriver = String(options.driver || process.env.DATASTORE_DRIVER || "").trim().toLowerCase();
  const shouldUseSupabase = requestedDriver === "supabase" || (requestedDriver !== "sqlite" && Boolean(process.env.SUPABASE_URL));
  if (shouldUseSupabase) {
    return createSupabaseDatastore(options);
  }

  const dbFile = options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite");
  const legacyUsersFile = options.legacyUsersFile || options.dataFile || path.join(__dirname, "..", "data", "users.json");
  const legacyGamesFile = options.legacyGamesFile || options.gamesFile || path.join(__dirname, "..", "data", "games.json");
  const legacySessionsFile = options.legacySessionsFile || options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json");

  ensureDirectory(dbFile);
  const db = new DatabaseSync(dbFile);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = FULL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      credentials_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version INTEGER NOT NULL,
      creator_user_id TEXT,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);

  const statements = {
    countUsers: db.prepare("SELECT COUNT(*) AS count FROM users"),
    countGames: db.prepare("SELECT COUNT(*) AS count FROM games"),
    countSessions: db.prepare("SELECT COUNT(*) AS count FROM sessions"),
    probe: db.prepare("SELECT 1 AS ok"),
    insertUser: db.prepare("INSERT INTO users (id, username, role, profile_json, credentials_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
    updateUserCredentials: db.prepare("UPDATE users SET credentials_json = ? WHERE id = ?"),
    updateUserRoleByUsername: db.prepare("UPDATE users SET role = ? WHERE lower(username) = lower(?)"),
    findUserByUsername: db.prepare("SELECT * FROM users WHERE lower(username) = lower(?)"),
    findUserById: db.prepare("SELECT * FROM users WHERE id = ?"),
    listUsers: db.prepare("SELECT * FROM users ORDER BY created_at ASC"),
    insertSession: db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)"),
    findSession: db.prepare("SELECT * FROM sessions WHERE token = ?"),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?"),
    listGames: db.prepare("SELECT * FROM games ORDER BY updated_at DESC"),
    findGameById: db.prepare("SELECT * FROM games WHERE id = ?"),
    insertGame: db.prepare("INSERT INTO games (id, name, version, creator_user_id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    updateGame: db.prepare("UPDATE games SET name = ?, version = ?, creator_user_id = ?, state_json = ?, updated_at = ? WHERE id = ?"),
    getAppState: db.prepare("SELECT value_json FROM app_state WHERE key = ?"),
    setAppState: db.prepare("INSERT INTO app_state (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json")
  };

  function transaction(run) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function migrateLegacyUsers() {
    if (Number(statements.countUsers.get().count) > 0) {
      return;
    }

    const users = readJsonFile(legacyUsersFile, [], Array.isArray);
    if (!users.length) {
      return;
    }

    transaction(() => {
      users.forEach((user) => {
        statements.insertUser.run(
          user.id,
          user.username,
          user.role === "admin" ? "admin" : "user",
          JSON.stringify(user.profile || {}),
          JSON.stringify(user.credentials || {}),
          user.createdAt || new Date().toISOString()
        );
      });
    });
  }

  function migrateLegacySessions() {
    if (Number(statements.countSessions.get().count) > 0) {
      return;
    }

    const sessions = readJsonFile(legacySessionsFile, [], Array.isArray);
    if (!sessions.length) {
      return;
    }

    transaction(() => {
      sessions.forEach((session) => {
        if (!session || !session.token || !session.userId) {
          return;
        }

        statements.insertSession.run(session.token, session.userId, Number(session.createdAt) || Date.now());
      });
    });
  }

  function migrateLegacyGames() {
    if (Number(statements.countGames.get().count) > 0) {
      return;
    }

    const database = readJsonFile(legacyGamesFile, { games: [], activeGameId: null }, (value) => Boolean(value) && typeof value === "object");
    const games = Array.isArray(database.games) ? database.games : [];
    if (!games.length) {
      return;
    }

    transaction(() => {
      games.forEach((game) => {
        statements.insertGame.run(
          game.id,
          game.name,
          Number.isInteger(game.version) && game.version > 0 ? game.version : 1,
          game.creatorUserId || null,
          JSON.stringify(game.state || {}),
          game.createdAt || new Date().toISOString(),
          game.updatedAt || game.createdAt || new Date().toISOString()
        );
      });

      if (database.activeGameId) {
        statements.setAppState.run("activeGameId", JSON.stringify(database.activeGameId));
      }
    });
  }

  migrateLegacyUsers();
  migrateLegacyGames();
  migrateLegacySessions();

  return {
    dbFile,
    resetForTests() {
      transaction(() => {
        db.exec(`
          DELETE FROM sessions;
          DELETE FROM users;
          DELETE FROM games;
          DELETE FROM app_state;
        `);
      });
    },
    async backupTo(targetFile) {
      if (!targetFile) {
        throw new Error("Il backup richiede un percorso destinazione valido.");
      }

      ensureDirectory(targetFile);
      await backup(db, targetFile);
      return {
        storage: "sqlite",
        sourceFile: dbFile,
        targetFile
      };
    },
    healthSummary() {
      const probe = statements.probe.get();
      return {
        ok: Boolean(probe && probe.ok === 1),
        storage: "sqlite",
        dbFile,
        journalMode: "WAL",
        counts: {
          users: Number(statements.countUsers.get().count) || 0,
          games: Number(statements.countGames.get().count) || 0,
          sessions: Number(statements.countSessions.get().count) || 0
        }
      };
    },
    close() {
      db.close();
    },
    findUserByUsername(username) {
      return normalizeUser(statements.findUserByUsername.get(String(username || "")));
    },
    findUserById(userId) {
      return normalizeUser(statements.findUserById.get(userId));
    },
    listUsers() {
      return statements.listUsers.all().map(normalizeUser);
    },
    createUser(user) {
      transaction(() => {
        statements.insertUser.run(
          user.id,
          user.username,
          user.role === "admin" ? "admin" : "user",
          JSON.stringify(user.profile || {}),
          JSON.stringify(user.credentials || {}),
          user.createdAt || new Date().toISOString()
        );
      });
      return this.findUserById(user.id);
    },
    updateUserCredentials(userId, credentials) {
      transaction(() => {
        statements.updateUserCredentials.run(JSON.stringify(credentials || {}), userId);
      });
      return this.findUserById(userId);
    },
    updateUserRoleByUsername(username, role) {
      transaction(() => {
        statements.updateUserRoleByUsername.run(role === "admin" ? "admin" : "user", username);
      });
    },
    createSession(token, userId, createdAt) {
      transaction(() => {
        statements.insertSession.run(token, userId, createdAt || Date.now());
      });
    },
    findSession(token) {
      return statements.findSession.get(token) || null;
    },
    deleteSession(token) {
      transaction(() => {
        statements.deleteSession.run(token);
      });
    },
    listGames() {
      return statements.listGames.all().map(normalizeGame);
    },
    findGameById(gameId) {
      return normalizeGame(statements.findGameById.get(gameId));
    },
    createGame(entry) {
      transaction(() => {
        statements.insertGame.run(
          entry.id,
          entry.name,
          Number.isInteger(entry.version) && entry.version > 0 ? entry.version : 1,
          entry.creatorUserId || null,
          JSON.stringify(entry.state || {}),
          entry.createdAt,
          entry.updatedAt
        );
      });
      return this.findGameById(entry.id);
    },
    updateGame(entry) {
      transaction(() => {
        statements.updateGame.run(
          entry.name,
          Number.isInteger(entry.version) && entry.version > 0 ? entry.version : 1,
          entry.creatorUserId || null,
          JSON.stringify(entry.state || {}),
          entry.updatedAt,
          entry.id
        );
      });
      return this.findGameById(entry.id);
    },
    getActiveGameId() {
      const row = statements.getAppState.get("activeGameId");
      return row ? parseJson(row.value_json, null) : null;
    },
    getAppStateValue(key, fallbackValue = null) {
      const row = statements.getAppState.get(String(key || ""));
      return row ? parseJson(row.value_json, fallbackValue) : fallbackValue;
    },
    setActiveGameId(gameId) {
      transaction(() => {
        statements.setAppState.run("activeGameId", JSON.stringify(gameId || null));
      });
    },
    setAppStateValue(key, value) {
      transaction(() => {
        statements.setAppState.run(String(key || ""), JSON.stringify(value));
      });
    }
  };
}

module.exports = {
  createDatastore
};
