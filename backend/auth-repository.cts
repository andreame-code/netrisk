const path = require("path");
const { createDatastore } = require("./datastore.cjs");

interface UserRecord {
  id: string;
  username: string;
  credentials?: Record<string, unknown>;
  role?: string;
  profile?: Record<string, unknown>;
  createdAt?: string;
}

interface SessionRecord {
  token: string;
  user_id: string;
  created_at: number;
}

interface UserRow {
  id: string;
  username: string;
  credentials_json?: string | Record<string, unknown> | null;
  credentials?: string | Record<string, unknown> | null;
  role?: string | null;
  profile_json?: string | Record<string, unknown> | null;
  profile?: string | Record<string, unknown> | null;
  created_at?: string | null;
  createdAt?: string | null;
}

interface SessionRow {
  token: string;
  user_id?: string | null;
  userId?: string | null;
  created_at?: number | string | null;
  createdAt?: number | string | null;
}

interface LocalDatastore {
  listUsers(): Promise<UserRecord[]> | UserRecord[];
  findUserByUsername(username: string): Promise<UserRecord | null> | UserRecord | null;
  findUserById(userId: string): Promise<UserRecord | null> | UserRecord | null;
  createUser(user: UserRecord): Promise<UserRecord | null> | UserRecord | null;
  updateUserCredentials(
    userId: string,
    credentials: Record<string, unknown>
  ): Promise<UserRecord | null> | UserRecord | null;
  updateUserProfile(
    userId: string,
    profile: Record<string, unknown>
  ): Promise<UserRecord | null> | UserRecord | null;
  updateUserThemePreference?(
    userId: string,
    theme: string
  ): Promise<UserRecord | null> | UserRecord | null;
  createSession(token: string, userId: string, createdAt: number): Promise<void> | void;
  findSession(
    token: string
  ): Promise<SessionRecord | SessionRow | null> | SessionRecord | SessionRow | null;
  deleteSession(token: string): Promise<void> | void;
  close?(): void;
}

interface AuthRepositoryOptions {
  datastore?: LocalDatastore;
  driver?: string;
  dbFile?: string;
  dataFile?: string;
  sessionsFile?: string;
  gamesFile?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseSchema?: string;
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
  } catch (_error) {
    return fallbackValue;
  }
}

function normalizeUser(row: UserRow | null | undefined): UserRecord | null {
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

function normalizeSession(
  row: SessionRow | SessionRecord | null | undefined
): SessionRecord | null {
  if (!row) {
    return null;
  }

  return {
    token: row.token,
    user_id: row.user_id || ("userId" in row ? row.userId : null) || "",
    created_at: Number(row.created_at ?? ("createdAt" in row ? row.createdAt : null) ?? Date.now())
  };
}

function createLocalAuthRepository(options: AuthRepositoryOptions = {}) {
  const datastore = (options.datastore ||
    createDatastore({
      dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
      legacyUsersFile: options.dataFile || path.join(__dirname, "..", "data", "users.json"),
      legacySessionsFile:
        options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json"),
      legacyGamesFile: options.gamesFile || path.join(__dirname, "..", "data", "games.json")
    })) as LocalDatastore;

  return {
    driver: "local",
    async listUsers() {
      return datastore.listUsers();
    },
    async findUserByUsername(username: string) {
      return datastore.findUserByUsername(username);
    },
    async findUserById(userId: string) {
      return datastore.findUserById(userId);
    },
    async createUser(user: UserRecord) {
      return datastore.createUser(user);
    },
    async updateUserCredentials(userId: string, credentials: Record<string, unknown>) {
      return datastore.updateUserCredentials(userId, credentials);
    },
    async updateUserProfile(userId: string, profile: Record<string, unknown>) {
      return datastore.updateUserProfile(userId, profile);
    },
    async updateUserThemePreference(userId: string, theme: string) {
      return typeof datastore.updateUserThemePreference === "function"
        ? datastore.updateUserThemePreference(userId, theme)
        : null;
    },
    async createSession(token: string, userId: string, createdAt: number) {
      await datastore.createSession(token, userId, createdAt);
    },
    async findSession(token: string) {
      return normalizeSession(await datastore.findSession(token));
    },
    async deleteSession(token: string) {
      await datastore.deleteSession(token);
    },
    close() {
      if (typeof datastore.close === "function") {
        datastore.close();
      }
    }
  };
}

function createSupabaseAuthRepository(options: AuthRepositoryOptions = {}) {
  const supabaseUrl = String(options.supabaseUrl || process.env.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const serviceRoleKey = String(
    options.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim();
  const schema =
    String(options.supabaseSchema || process.env.SUPABASE_DB_SCHEMA || "public").trim() || "public";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configurazione Supabase incompleta per il repository auth.");
  }

  function ilikeValue(value: unknown): string {
    return String(value || "").replace(/[%_]/g, (token) => `\\${token}`);
  }

  async function request(
    table: string,
    method: string = "GET",
    query: Record<string, unknown> = {},
    body?: unknown,
    preferRepresentation: boolean = false
  ): Promise<unknown> {
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
      const message =
        (payload as Record<string, unknown> | null)?.message ||
        (payload as Record<string, unknown> | null)?.error_description ||
        (payload as Record<string, unknown> | null)?.error ||
        `Supabase auth request fallita (${response.status}).`;
      throw new Error(String(message));
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
      return Array.isArray(rows)
        ? rows.map((row) => normalizeUser(row as UserRow)).filter(Boolean)
        : [];
    },
    async findUserByUsername(username: string) {
      const rows = await request("users", "GET", {
        select: "*",
        username: `ilike.${ilikeValue(String(username || "").trim())}`,
        limit: 1
      });
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0] as UserRow) : null;
    },
    async findUserById(userId: string) {
      const rows = await request("users", "GET", {
        select: "*",
        id: `eq.${String(userId || "").trim()}`,
        limit: 1
      });
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0] as UserRow) : null;
    },
    async createUser(user: UserRecord) {
      const rows = await request(
        "users",
        "POST",
        {},
        [
          {
            id: user.id,
            username: user.username,
            role: user.role === "admin" ? "admin" : "user",
            profile_json: JSON.stringify(user.profile || {}),
            credentials_json: JSON.stringify(user.credentials || {}),
            created_at: user.createdAt || new Date().toISOString()
          }
        ],
        true
      );
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0] as UserRow) : null;
    },
    async updateUserCredentials(userId: string, credentials: Record<string, unknown>) {
      const rows = await request(
        "users",
        "PATCH",
        {
          id: `eq.${String(userId || "").trim()}`
        },
        {
          credentials_json: JSON.stringify(credentials || {})
        },
        true
      );
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0] as UserRow) : null;
    },
    async updateUserProfile(userId: string, profile: Record<string, unknown>) {
      const rows = await request(
        "users",
        "PATCH",
        {
          id: `eq.${String(userId || "").trim()}`
        },
        {
          profile_json: JSON.stringify(profile || {})
        },
        true
      );
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0] as UserRow) : null;
    },
    async updateUserThemePreference(userId: string, theme: string) {
      const latestUser = await this.findUserById(userId);
      if (!latestUser) {
        return null;
      }

      const rows = await request(
        "users",
        "PATCH",
        {
          id: `eq.${String(userId || "").trim()}`
        },
        {
          profile_json: JSON.stringify({
            ...(latestUser.profile || {}),
            preferences: {
              ...(((latestUser.profile as Record<string, unknown> | undefined)?.preferences as
                | Record<string, unknown>
                | undefined) || {}),
              theme: String(theme || "")
            }
          })
        },
        true
      );
      return Array.isArray(rows) && rows.length ? normalizeUser(rows[0] as UserRow) : null;
    },
    async createSession(token: string, userId: string, createdAt: number) {
      await request(
        "sessions",
        "POST",
        {},
        [
          {
            token,
            user_id: userId,
            created_at: createdAt || Date.now()
          }
        ],
        false
      );
    },
    async findSession(token: string) {
      const rows = await request("sessions", "GET", {
        select: "*",
        token: `eq.${String(token || "").trim()}`,
        limit: 1
      });
      return Array.isArray(rows) && rows.length ? normalizeSession(rows[0] as SessionRow) : null;
    },
    async deleteSession(token: string) {
      await request("sessions", "DELETE", {
        token: `eq.${String(token || "").trim()}`
      });
    },
    close() {}
  };
}

function createAuthRepository(options: AuthRepositoryOptions = {}) {
  const driver = String(options.driver || process.env.DATASTORE_DRIVER || "local")
    .trim()
    .toLowerCase();
  return driver === "supabase"
    ? createSupabaseAuthRepository(options)
    : createLocalAuthRepository(options);
}

module.exports = {
  createAuthRepository
};
