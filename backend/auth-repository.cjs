const path = require("path");
const { createDatastore } = require("./datastore.cjs");

function parseJson(value, fallbackValue) {
  if (value == null || value === "") {
    return fallbackValue;
  }

  if (typeof value !== "string") {
    return value;
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
    credentials: parseJson(row.credentials_json ?? row.credentials, {}),
    role: row.role || "user",
    profile: parseJson(row.profile_json ?? row.profile, {}),
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}

function normalizeSession(row) {
  if (!row) {
    return null;
  }

  return {
    token: row.token,
    user_id: row.user_id || row.userId,
    created_at: Number(row.created_at ?? row.createdAt ?? Date.now())
  };
}

function createLocalAuthRepository(options = {}) {
  const datastore = options.datastore || createDatastore({
    dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
    legacyUsersFile: options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    legacySessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json"),
    legacyGamesFile: options.gamesFile || path.join(__dirname, "..", "data", "games.json")
  });

  return {
    driver: "local",
    async listUsers() {
      return datastore.listUsers();
    },
    async findUserByUsername(username) {
      return datastore.findUserByUsername(username);
    },
    async findUserById(userId) {
      return datastore.findUserById(userId);
    },
    async createUser(user) {
      return datastore.createUser(user);
    },
    async updateUserCredentials(userId, credentials) {
      return datastore.updateUserCredentials(userId, credentials);
    },
    async updateUserProfile(userId, profile) {
      return datastore.updateUserProfile(userId, profile);
    },
    async updateUserThemePreference(userId, theme) {
      return datastore.updateUserThemePreference(userId, theme);
    },
    async createSession(token, userId, createdAt) {
      datastore.createSession(token, userId, createdAt);
    },
    async findSession(token) {
      return normalizeSession(datastore.findSession(token));
    },
    async deleteSession(token) {
      datastore.deleteSession(token);
    },
    close() {
      if (typeof datastore.close === "function") {
        datastore.close();
      }
    }
  };
}

function createSupabaseAuthRepository(options = {}) {
  const supabaseUrl = String(options.supabaseUrl || process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(options.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const schema = String(options.supabaseSchema || process.env.SUPABASE_DB_SCHEMA || "public").trim() || "public";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configurazione Supabase incompleta per il repository auth.");
  }

  function ilikeValue(value) {
    return String(value || "").replace(/[%_]/g, (token) => `\\${token}`);
  }

  async function request(table, method = "GET", query = {}, body, preferRepresentation = false) {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });

    const url = `${supabaseUrl}/rest/v1/${table}${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetch(url, {
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
        "Accept-Profile": schema,
        "Content-Profile": schema,
        "Content-Type": "application/json",
        Prefer: preferRepresentation ? "return=representation" : "return=minimal"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      const message = payload?.message || payload?.error_description || payload?.error || `Supabase auth request fallita (${response.status}).`;
      throw new Error(message);
    }

    return payload;
  }

  return {
    driver: "supabase",
    async listUsers() {
      const rows = await request("users", "GET", {
        select: "*",
        order: "created_at.asc"
      });
      return Array.isArray(rows) ? rows.map(normalizeUser) : [];
    },
    async findUserByUsername(username) {
      const rows = await request("users", "GET", {
        select: "*",
        username: `ilike.${ilikeValue(String(username || "").trim())}`,
        limit: 1
      });
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0]) : null;
    },
    async findUserById(userId) {
      const rows = await request("users", "GET", {
        select: "*",
        id: `eq.${String(userId || "").trim()}`,
        limit: 1
      });
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0]) : null;
    },
    async createUser(user) {
      const rows = await request("users", "POST", {}, [{
        id: user.id,
        username: user.username,
        role: user.role === "admin" ? "admin" : "user",
        profile_json: JSON.stringify(user.profile || {}),
        credentials_json: JSON.stringify(user.credentials || {}),
        created_at: user.createdAt || new Date().toISOString()
      }], true);
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0]) : null;
    },
    async updateUserCredentials(userId, credentials) {
      const rows = await request("users", "PATCH", {
        id: `eq.${String(userId || "").trim()}`
      }, {
        credentials_json: JSON.stringify(credentials || {})
      }, true);
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0]) : null;
    },
    async updateUserProfile(userId, profile) {
      const rows = await request("users", "PATCH", {
        id: `eq.${String(userId || "").trim()}`
      }, {
        profile_json: JSON.stringify(profile || {})
      }, true);
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0]) : null;
    },
    async updateUserThemePreference(userId, theme) {
      const latestUser = await this.findUserById(userId);
      if (!latestUser) {
        return null;
      }

      const rows = await request("users", "PATCH", {
        id: `eq.${String(userId || "").trim()}`
      }, {
        profile_json: JSON.stringify({
          ...(latestUser.profile || {}),
          preferences: {
            ...(latestUser.profile?.preferences || {}),
            theme: String(theme || "")
          }
        })
      }, true);
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0]) : null;
    },
    async createSession(token, userId, createdAt) {
      await request("sessions", "POST", {}, [{
        token,
        user_id: userId,
        created_at: createdAt || Date.now()
      }], false);
    },
    async findSession(token) {
      const rows = await request("sessions", "GET", {
        select: "*",
        token: `eq.${String(token || "").trim()}`,
        limit: 1
      });
      return Array.isArray(rows) && rows.length ? normalizeSession(rows[0]) : null;
    },
    async deleteSession(token) {
      await request("sessions", "DELETE", {
        token: `eq.${String(token || "").trim()}`
      });
    },
    close() {
    }
  };
}

function createAuthRepository(options = {}) {
  const driver = String(options.driver || process.env.DATASTORE_DRIVER || "local").trim().toLowerCase();
  return driver === "supabase"
    ? createSupabaseAuthRepository(options)
    : createLocalAuthRepository(options);
}

module.exports = {
  createAuthRepository
};
