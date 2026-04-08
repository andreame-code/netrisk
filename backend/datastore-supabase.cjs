const { readJsonFile } = require("./json-file-store.cjs");

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
    version: Number.isInteger(row.version) ? row.version : Number(row.version) || 1,
    creatorUserId: row.creator_user_id || null,
    state: parseJson(row.state_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeSession(row) {
  if (!row) {
    return null;
  }

  return {
    token: row.token,
    user_id: row.user_id,
    created_at: row.created_at
  };
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Variabile ambiente mancante: ${name}`);
  }
  return value;
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

function toQueryString(filters = {}) {
  const parts = [];
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null) {
      return;
    }

    parts.push(`${encodeURIComponent(key)}=${encodeFilterValue(value)}`);
  });
  return parts.length ? `?${parts.join("&")}` : "";
}

function createSupabaseDatastore(options = {}) {
  const supabaseUrl = String(
    options.supabaseUrl ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  ).replace(/\/$/, "");
  const supabaseKey = String(
    options.supabaseServiceRoleKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!supabaseKey) {
    throw new Error("Variabile ambiente mancante: SUPABASE_SERVICE_ROLE_KEY");
  }

  const schema = options.schema || process.env.SUPABASE_DB_SCHEMA || "public";
  const restBaseUrl = `${supabaseUrl}/rest/v1`;
  const legacyUsersFile = options.legacyUsersFile || options.dataFile || null;
  const legacyGamesFile = options.legacyGamesFile || options.gamesFile || null;
  const legacySessionsFile = options.legacySessionsFile || options.sessionsFile || null;
  let initialized = false;

  async function request(pathname, init = {}) {
    const response = await fetch(restBaseUrl + pathname, {
      method: init.method || "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: init.prefer || "return=representation",
        "Accept-Profile": schema,
        "Content-Profile": schema,
        ...init.headers
      },
      body: init.body == null ? undefined : JSON.stringify(init.body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase request failed (${response.status}): ${text || pathname}`);
    }

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function selectOne(tableName, filters = {}, options = {}) {
    const query = toQueryString({
      select: options.select || "*",
      limit: 1,
      ...filters
    });
    const rows = await request(`/${tableName}${query}`, {
      method: "GET",
      headers: {
        Prefer: "count=exact"
      }
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async function selectMany(tableName, filters = {}, options = {}) {
    const query = toQueryString({
      select: options.select || "*",
      order: options.order || null,
      ...filters
    });
    const rows = await request(`/${tableName}${query}`, {
      method: "GET",
      headers: {
        Prefer: "count=exact"
      }
    });
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertRows(tableName, rows, onConflict) {
    return request(`/${tableName}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation"
    });
  }

  async function insertRow(tableName, row) {
    const rows = await request(`/${tableName}`, {
      method: "POST",
      body: [row]
    });
    return Array.isArray(rows) ? rows[0] || null : rows;
  }

  async function patchRows(tableName, filters, patch) {
    const query = toQueryString(filters);
    const rows = await request(`/${tableName}${query}`, {
      method: "PATCH",
      body: patch
    });
    return Array.isArray(rows) ? rows : [];
  }

  async function deleteRows(tableName, filters) {
    const query = toQueryString(filters);
    return request(`/${tableName}${query}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
  }

  async function countRows(tableName, columnName = "id") {
    const rows = await selectMany(tableName, {}, { select: columnName, order: `${columnName}.asc` });
    return rows.length;
  }

  async function migrateLegacyUsers() {
    if (!legacyUsersFile) {
      return;
    }

    const existing = await countRows("users", "id");
    if (existing > 0) {
      return;
    }

    const users = readJsonFile(legacyUsersFile, [], Array.isArray);
    if (!users.length) {
      return;
    }

    await upsertRows("users", users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role === "admin" ? "admin" : "user",
      profile_json: JSON.stringify(user.profile || {}),
      credentials_json: JSON.stringify(user.credentials || {}),
      created_at: user.createdAt || new Date().toISOString()
    })), "id");
  }

  async function migrateLegacySessions() {
    if (!legacySessionsFile) {
      return;
    }

    const existing = await countRows("sessions", "token");
    if (existing > 0) {
      return;
    }

    const sessions = readJsonFile(legacySessionsFile, [], Array.isArray);
    if (!sessions.length) {
      return;
    }

    const existingUsers = new Set((await selectMany("users", {}, { select: "id", order: "id.asc" })).map((user) => user.id));

    await upsertRows("sessions", sessions
      .filter((session) => session && session.token && session.userId && existingUsers.has(session.userId))
      .map((session) => ({
        token: session.token,
        user_id: session.userId,
        created_at: Number(session.createdAt) || Date.now()
      })), "token");
  }

  async function migrateLegacyGames() {
    if (!legacyGamesFile) {
      return;
    }

    const existing = await countRows("games", "id");
    if (existing > 0) {
      return;
    }

    const database = readJsonFile(legacyGamesFile, { games: [], activeGameId: null }, (value) => Boolean(value) && typeof value === "object");
    const games = Array.isArray(database.games) ? database.games : [];
    if (!games.length) {
      return;
    }

    await upsertRows("games", games.map((game) => ({
      id: game.id,
      name: game.name,
      version: Number.isInteger(game.version) && game.version > 0 ? game.version : 1,
      creator_user_id: game.creatorUserId || null,
      state_json: JSON.stringify(game.state || {}),
      created_at: game.createdAt || new Date().toISOString(),
      updated_at: game.updatedAt || game.createdAt || new Date().toISOString()
    })), "id");

    if (database.activeGameId) {
      await upsertRows("app_state", [{
        key: "activeGameId",
        value_json: JSON.stringify(database.activeGameId)
      }], "key");
    }
  }

  async function ensureInitialized() {
    if (initialized) {
      return;
    }

    await migrateLegacyUsers();
    await migrateLegacyGames();
    await migrateLegacySessions();
    initialized = true;
  }

  return {
    driver: "supabase",
    async backupTo() {
      throw new Error("Il backup file-based non e disponibile con Supabase/Postgres.");
    },
    async healthSummary() {
      await ensureInitialized();
      return {
        ok: true,
        storage: "supabase",
        url: supabaseUrl,
        schema,
        counts: {
          users: await countRows("users", "id"),
          games: await countRows("games", "id"),
          sessions: await countRows("sessions", "token")
        }
      };
    },
    close() {
      return undefined;
    },
    async findUserByUsername(username) {
      await ensureInitialized();
      const row = await selectOne("users", {
        username: `eq.${username}`
      });
      return normalizeUser(row);
    },
    async findUserById(userId) {
      await ensureInitialized();
      return normalizeUser(await selectOne("users", { id: `eq.${userId}` }));
    },
    async listUsers() {
      await ensureInitialized();
      return (await selectMany("users", {}, { order: "created_at.asc" })).map(normalizeUser);
    },
    async createUser(user) {
      await ensureInitialized();
      await insertRow("users", {
        id: user.id,
        username: user.username,
        role: user.role === "admin" ? "admin" : "user",
        profile_json: JSON.stringify(user.profile || {}),
        credentials_json: JSON.stringify(user.credentials || {}),
        created_at: user.createdAt || new Date().toISOString()
      });
      return this.findUserById(user.id);
    },
    async updateUserCredentials(userId, credentials) {
      await ensureInitialized();
      await patchRows("users", { id: `eq.${userId}` }, {
        credentials_json: JSON.stringify(credentials || {})
      });
      return this.findUserById(userId);
    },
    async updateUserRoleByUsername(username, role) {
      await ensureInitialized();
      await patchRows("users", { username: `eq.${username}` }, {
        role: role === "admin" ? "admin" : "user"
      });
    },
    async createSession(token, userId, createdAt) {
      await ensureInitialized();
      await insertRow("sessions", {
        token,
        user_id: userId,
        created_at: createdAt || Date.now()
      });
    },
    async findSession(token) {
      await ensureInitialized();
      return normalizeSession(await selectOne("sessions", { token: `eq.${token}` }));
    },
    async deleteSession(token) {
      await ensureInitialized();
      await deleteRows("sessions", { token: `eq.${token}` });
    },
    async listGames() {
      await ensureInitialized();
      return (await selectMany("games", {}, { order: "updated_at.desc" })).map(normalizeGame);
    },
    async findGameById(gameId) {
      await ensureInitialized();
      return normalizeGame(await selectOne("games", { id: `eq.${gameId}` }));
    },
    async createGame(entry) {
      await ensureInitialized();
      await insertRow("games", {
        id: entry.id,
        name: entry.name,
        version: Number.isInteger(entry.version) && entry.version > 0 ? entry.version : 1,
        creator_user_id: entry.creatorUserId || null,
        state_json: JSON.stringify(entry.state || {}),
        created_at: entry.createdAt,
        updated_at: entry.updatedAt
      });
      return this.findGameById(entry.id);
    },
    async updateGame(entry) {
      await ensureInitialized();
      const updated = await patchRows("games", {
        id: `eq.${entry.id}`,
        version: `eq.${Number.isInteger(entry.version) && entry.version > 1 ? entry.version - 1 : 1}`
      }, {
        name: entry.name,
        version: Number.isInteger(entry.version) && entry.version > 0 ? entry.version : 1,
        creator_user_id: entry.creatorUserId || null,
        state_json: JSON.stringify(entry.state || {}),
        updated_at: entry.updatedAt
      });

      if (!updated.length) {
        const conflict = new Error("La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.");
        conflict.code = "VERSION_CONFLICT";
        const current = await this.findGameById(entry.id);
        conflict.currentVersion = current ? current.version : null;
        conflict.currentState = current ? current.state : null;
        throw conflict;
      }

      return normalizeGame(updated[0]);
    },
    async getActiveGameId() {
      await ensureInitialized();
      const row = await selectOne("app_state", { key: "eq.activeGameId" });
      return row ? parseJson(row.value_json, null) : null;
    },
    async getAppStateValue(key, fallbackValue = null) {
      await ensureInitialized();
      const row = await selectOne("app_state", { key: `eq.${String(key || "")}` });
      return row ? parseJson(row.value_json, fallbackValue) : fallbackValue;
    },
    async setActiveGameId(gameId) {
      await ensureInitialized();
      await upsertRows("app_state", [{
        key: "activeGameId",
        value_json: JSON.stringify(gameId || null)
      }], "key");
    },
    async setAppStateValue(key, value) {
      await ensureInitialized();
      await upsertRows("app_state", [{
        key: String(key || ""),
        value_json: JSON.stringify(value)
      }], "key");
    }
  };
}

module.exports = {
  createSupabaseDatastore
};
