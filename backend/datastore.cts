const fs = require("fs");
const path = require("path");
const { DatabaseSync, backup } = require("node:sqlite");
const { readJsonFile } = require("./json-file-store.cjs") as {
  readJsonFile: <T>(filePath: string, fallbackValue: T, isValid?: (value: unknown) => boolean) => T;
};
const { createSupabaseDatastore } = require("./datastore-supabase.cjs");

type JsonRecord = Record<string, unknown>;

type UserRecord = {
  id: string;
  username: string;
  credentials: JsonRecord;
  role: string;
  profile: JsonRecord;
  createdAt: string;
};

type GameRecord = {
  id: string;
  name: string;
  version: number;
  creatorUserId: string | null;
  state: JsonRecord;
  createdAt: string;
  updatedAt: string;
};

type SessionRecord = {
  token: string;
  user_id: string;
  created_at: number;
};

type UserRow = {
  id: string;
  username: string;
  credentials_json?: string | null;
  role?: string | null;
  profile_json?: string | null;
  created_at?: string | null;
};

type GameRow = {
  id: string;
  name: string;
  version?: number | null;
  creator_user_id?: string | null;
  state_json?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SessionRow = {
  token: string;
  user_id?: string | null;
  created_at?: number | null;
};

type AppStateRow = {
  value_json?: string | null;
};

type CountRow = {
  count?: number | bigint | string | null;
};

type ProbeRow = {
  ok?: number | null;
};

type Statement<Row> = {
  get(...args: unknown[]): Row;
  all(...args: unknown[]): Row[];
  run(...args: unknown[]): unknown;
};

type DatastoreOptions = {
  driver?: string;
  dbFile?: string;
  dataFile?: string;
  gamesFile?: string;
  sessionsFile?: string;
  legacyUsersFile?: string;
  legacyGamesFile?: string;
  legacySessionsFile?: string;
};

type LegacyUser = {
  id: string;
  username: string;
  role?: string;
  profile?: JsonRecord;
  credentials?: JsonRecord;
  createdAt?: string;
};

type LegacySession = {
  token?: string;
  userId?: string;
  createdAt?: number | string;
};

type LegacyGame = {
  id: string;
  name: string;
  version?: number;
  creatorUserId?: string | null;
  state?: JsonRecord;
  createdAt?: string;
  updatedAt?: string;
};

type LegacyGamesDatabase = {
  games?: LegacyGame[];
  activeGameId?: string | null;
};

function ensureDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseJson<T>(value: unknown, fallbackValue: T): T {
  if (value == null || value === "") {
    return fallbackValue;
  }

  if (typeof value !== "string") {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    return fallbackValue;
  }
}

function normalizeUser(row: UserRow | null): UserRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    credentials: parseJson<JsonRecord>(row.credentials_json, {}),
    role: row.role || "user",
    profile: parseJson<JsonRecord>(row.profile_json, {}),
    createdAt: row.created_at || new Date().toISOString()
  };
}

function normalizeGame(row: GameRow | null): GameRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    version: Number.isInteger(row.version) ? Number(row.version) : 1,
    creatorUserId: row.creator_user_id || null,
    state: parseJson<JsonRecord>(row.state_json, {}),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString()
  };
}

function createDatastore(options: DatastoreOptions = {}) {
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
    countUsers: db.prepare("SELECT COUNT(*) AS count FROM users") as Statement<CountRow>,
    countGames: db.prepare("SELECT COUNT(*) AS count FROM games") as Statement<CountRow>,
    countSessions: db.prepare("SELECT COUNT(*) AS count FROM sessions") as Statement<CountRow>,
    probe: db.prepare("SELECT 1 AS ok") as Statement<ProbeRow>,
    insertUser: db.prepare("INSERT INTO users (id, username, role, profile_json, credentials_json, created_at) VALUES (?, ?, ?, ?, ?, ?)") as Statement<unknown>,
    updateUserCredentials: db.prepare("UPDATE users SET credentials_json = ? WHERE id = ?") as Statement<unknown>,
    updateUserProfile: db.prepare("UPDATE users SET profile_json = ? WHERE id = ?") as Statement<unknown>,
    updateUserThemePreference: db.prepare("UPDATE users SET profile_json = json_patch(COALESCE(NULLIF(profile_json, ''), '{}'), json_object('preferences', json_object('theme', ?))) WHERE id = ?") as Statement<unknown>,
    updateUserRoleByUsername: db.prepare("UPDATE users SET role = ? WHERE lower(username) = lower(?)") as Statement<unknown>,
    findUserByUsername: db.prepare("SELECT * FROM users WHERE lower(username) = lower(?)") as Statement<UserRow | null>,
    findUserById: db.prepare("SELECT * FROM users WHERE id = ?") as Statement<UserRow | null>,
    listUsers: db.prepare("SELECT * FROM users ORDER BY created_at ASC") as Statement<UserRow>,
    insertSession: db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)") as Statement<unknown>,
    findSession: db.prepare("SELECT * FROM sessions WHERE token = ?") as Statement<SessionRow | null>,
    deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?") as Statement<unknown>,
    listGames: db.prepare("SELECT * FROM games ORDER BY updated_at DESC") as Statement<GameRow>,
    findGameById: db.prepare("SELECT * FROM games WHERE id = ?") as Statement<GameRow | null>,
    insertGame: db.prepare("INSERT INTO games (id, name, version, creator_user_id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)") as Statement<unknown>,
    updateGame: db.prepare("UPDATE games SET name = ?, version = ?, creator_user_id = ?, state_json = ?, updated_at = ? WHERE id = ?") as Statement<unknown>,
    getAppState: db.prepare("SELECT value_json FROM app_state WHERE key = ?") as Statement<AppStateRow | null>,
    setAppState: db.prepare("INSERT INTO app_state (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json") as Statement<unknown>
  };

  function transaction<T>(run: () => T): T {
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

    const users = readJsonFile<LegacyUser[]>(legacyUsersFile, [], Array.isArray);
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

    const sessions = readJsonFile<LegacySession[]>(legacySessionsFile, [], Array.isArray);
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

    const database = readJsonFile<LegacyGamesDatabase>(
      legacyGamesFile,
      { games: [], activeGameId: null },
      (value) => Boolean(value) && typeof value === "object"
    );
    const games = Array.isArray(database.games) ? database.games : [];
    if (!games.length) {
      return;
    }

    transaction(() => {
      games.forEach((game) => {
        statements.insertGame.run(
          game.id,
          game.name,
          typeof game.version === "number" && Number.isInteger(game.version) && game.version > 0 ? game.version : 1,
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

  const datastore = {
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
    async backupTo(targetFile: string) {
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
    findUserByUsername(username: string) {
      return normalizeUser(statements.findUserByUsername.get(String(username || "")));
    },
    findUserById(userId: string) {
      return normalizeUser(statements.findUserById.get(userId));
    },
    listUsers() {
      return statements.listUsers.all().map((row) => normalizeUser(row));
    },
    createUser(user: UserRecord) {
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
      return datastore.findUserById(user.id);
    },
    updateUserCredentials(userId: string, credentials: JsonRecord) {
      transaction(() => {
        statements.updateUserCredentials.run(JSON.stringify(credentials || {}), userId);
      });
      return datastore.findUserById(userId);
    },
    updateUserProfile(userId: string, profile: JsonRecord) {
      transaction(() => {
        statements.updateUserProfile.run(JSON.stringify(profile || {}), userId);
      });
      return datastore.findUserById(userId);
    },
    updateUserThemePreference(userId: string, theme: string) {
      transaction(() => {
        statements.updateUserThemePreference.run(String(theme || ""), userId);
      });
      return datastore.findUserById(userId);
    },
    updateUserRoleByUsername(username: string, role: string) {
      transaction(() => {
        statements.updateUserRoleByUsername.run(role === "admin" ? "admin" : "user", username);
      });
    },
    createSession(token: string, userId: string, createdAt: number) {
      transaction(() => {
        statements.insertSession.run(token, userId, createdAt || Date.now());
      });
    },
    findSession(token: string) {
      return statements.findSession.get(token) || null;
    },
    deleteSession(token: string) {
      transaction(() => {
        statements.deleteSession.run(token);
      });
    },
    listGames() {
      return statements.listGames.all().map((row) => normalizeGame(row));
    },
    findGameById(gameId: string) {
      return normalizeGame(statements.findGameById.get(gameId));
    },
    createGame(entry: GameRecord) {
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
      return datastore.findGameById(entry.id);
    },
    updateGame(entry: GameRecord) {
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
      return datastore.findGameById(entry.id);
    },
    getActiveGameId() {
      const row = statements.getAppState.get("activeGameId");
      return row ? parseJson<string | null>(row.value_json, null) : null;
    },
    setActiveGameId(gameId: string | null) {
      transaction(() => {
        statements.setAppState.run("activeGameId", JSON.stringify(gameId || null));
      });
    }
  } as const;

  return datastore;
}

module.exports = {
  createDatastore
};
