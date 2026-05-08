const { readJsonFile } = require("./json-file-store.cjs") as {
  readJsonFile: <T>(filePath: string, fallbackValue: T, isValid?: (value: unknown) => boolean) => T;
};

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
  version?: number | string | null;
  creator_user_id?: string | null;
  state_json?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SessionRow = {
  token: string;
  user_id?: string | null;
  created_at?: number | string | null;
};

type AppStateRow = {
  value_json?: string | null;
};

type SupabaseDatastoreOptions = {
  driver?: string;
  schema?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  legacyUsersFile?: string | null;
  legacyGamesFile?: string | null;
  legacySessionsFile?: string | null;
  dataFile?: string | null;
  gamesFile?: string | null;
  sessionsFile?: string | null;
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

type VersionConflictError = Error & {
  code: "VERSION_CONFLICT";
  currentVersion: number | null;
  currentState: JsonRecord | null;
};

type QueryFilters = Record<string, string | number | null | undefined>;
type SupabaseRequestInit = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
  prefer?: string;
};

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
    version: Number.isInteger(row.version) ? Number(row.version) : Number(row.version) || 1,
    creatorUserId: row.creator_user_id || null,
    state: parseJson<JsonRecord>(row.state_json, {}),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString()
  };
}

function normalizeSession(row: SessionRow | null): SessionRecord | null {
  if (!row) {
    return null;
  }

  return {
    token: row.token,
    user_id: row.user_id || "",
    created_at: Number(row.created_at) || Date.now()
  };
}

function requiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Variabile ambiente mancante: ${name}`);
  }
  return value;
}

function encodeFilterValue(value: string | number): string {
  return encodeURIComponent(String(value));
}

function toQueryString(filters: QueryFilters = {}): string {
  const parts: string[] = [];
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null) {
      return;
    }

    parts.push(`${encodeURIComponent(key)}=${encodeFilterValue(value)}`);
  });
  return parts.length ? `?${parts.join("&")}` : "";
}

function escapePostgrestLikeValue(value: string): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function createSupabaseDatastore(options: SupabaseDatastoreOptions = {}) {
  const supabaseUrl = String(
    options.supabaseUrl ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  ).replace(/\/$/, "");
  const supabaseKey = String(
    options.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
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

  async function request(pathname: string, init: SupabaseRequestInit = {}): Promise<unknown> {
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

  async function selectOne<TRow extends JsonRecord>(
    tableName: string,
    filters: QueryFilters = {},
    options: { select?: string } = {}
  ): Promise<TRow | null> {
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
    return Array.isArray(rows) && rows.length > 0 ? (rows[0] as TRow) : null;
  }

  async function selectMany<TRow extends JsonRecord>(
    tableName: string,
    filters: QueryFilters = {},
    options: { select?: string; order?: string | null } = {}
  ): Promise<TRow[]> {
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
    return Array.isArray(rows) ? (rows as TRow[]) : [];
  }

  async function upsertRows<TRow extends JsonRecord>(
    tableName: string,
    rows: TRow[],
    onConflict: string
  ): Promise<unknown> {
    return request(`/${tableName}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation"
    });
  }

  async function insertRow<TRow extends JsonRecord>(
    tableName: string,
    row: TRow
  ): Promise<TRow | null> {
    const rows = await request(`/${tableName}`, {
      method: "POST",
      body: [row]
    });
    return Array.isArray(rows) ? (rows[0] as TRow | undefined) || null : (rows as TRow | null);
  }

  async function patchRows<TRow extends JsonRecord>(
    tableName: string,
    filters: QueryFilters,
    patch: JsonRecord
  ): Promise<TRow[]> {
    const query = toQueryString(filters);
    const rows = await request(`/${tableName}${query}`, {
      method: "PATCH",
      body: patch
    });
    return Array.isArray(rows) ? (rows as TRow[]) : [];
  }

  async function deleteRows(tableName: string, filters: QueryFilters): Promise<unknown> {
    const query = toQueryString(filters);
    return request(`/${tableName}${query}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
  }

  async function countRows(tableName: string, columnName: string = "id"): Promise<number> {
    const rows = await selectMany<JsonRecord>(
      tableName,
      {},
      { select: columnName, order: `${columnName}.asc` }
    );
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

    const users = readJsonFile<LegacyUser[]>(legacyUsersFile, [], Array.isArray);
    if (!users.length) {
      return;
    }

    await upsertRows(
      "users",
      users.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role === "admin" ? "admin" : "user",
        profile_json: JSON.stringify(user.profile || {}),
        credentials_json: JSON.stringify(user.credentials || {}),
        created_at: user.createdAt || new Date().toISOString()
      })),
      "id"
    );
  }

  async function migrateLegacySessions() {
    if (!legacySessionsFile) {
      return;
    }

    const existing = await countRows("sessions", "token");
    if (existing > 0) {
      return;
    }

    const sessions = readJsonFile<LegacySession[]>(legacySessionsFile, [], Array.isArray);
    if (!sessions.length) {
      return;
    }

    const existingUsers = new Set(
      (await selectMany<{ id: string }>("users", {}, { select: "id", order: "id.asc" })).map(
        (user) => user.id
      )
    );

    await upsertRows(
      "sessions",
      sessions
        .filter(
          (session) =>
            session && session.token && session.userId && existingUsers.has(session.userId)
        )
        .map((session) => ({
          token: session.token,
          user_id: session.userId,
          created_at: Number(session.createdAt) || Date.now()
        })),
      "token"
    );
  }

  async function migrateLegacyGames() {
    if (!legacyGamesFile) {
      return;
    }

    const existing = await countRows("games", "id");
    if (existing > 0) {
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

    await upsertRows(
      "games",
      games.map((game) => ({
        id: game.id,
        name: game.name,
        version:
          typeof game.version === "number" && Number.isInteger(game.version) && game.version > 0
            ? game.version
            : 1,
        creator_user_id: game.creatorUserId || null,
        state_json: JSON.stringify(game.state || {}),
        created_at: game.createdAt || new Date().toISOString(),
        updated_at: game.updatedAt || game.createdAt || new Date().toISOString()
      })),
      "id"
    );

    if (database.activeGameId) {
      await upsertRows(
        "app_state",
        [
          {
            key: "activeGameId",
            value_json: JSON.stringify(database.activeGameId)
          }
        ],
        "key"
      );
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

  const datastore = {
    driver: "supabase",
    async backupTo() {
      throw new Error("Il backup file-based non e disponibile con Supabase/Postgres.");
    },
    async healthSummary() {
      await ensureInitialized();
      return {
        ok: true,
        storage: "supabase",
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
    async findUserByUsername(username: string) {
      await ensureInitialized();
      const row = await selectOne<UserRow>("users", {
        username: `ilike.${escapePostgrestLikeValue(username)}`
      });
      return normalizeUser(row);
    },
    async findUserById(userId: string) {
      await ensureInitialized();
      return normalizeUser(await selectOne<UserRow>("users", { id: `eq.${userId}` }));
    },
    async listUsers() {
      await ensureInitialized();
      return (await selectMany<UserRow>("users", {}, { order: "created_at.asc" })).map((row) =>
        normalizeUser(row)
      );
    },
    async createUser(user: UserRecord) {
      await ensureInitialized();
      await insertRow("users", {
        id: user.id,
        username: user.username,
        role: user.role === "admin" ? "admin" : "user",
        profile_json: JSON.stringify(user.profile || {}),
        credentials_json: JSON.stringify(user.credentials || {}),
        created_at: user.createdAt || new Date().toISOString()
      });
      return datastore.findUserById(user.id);
    },
    async updateUserCredentials(userId: string, credentials: JsonRecord) {
      await ensureInitialized();
      await patchRows(
        "users",
        { id: `eq.${userId}` },
        {
          credentials_json: JSON.stringify(credentials || {})
        }
      );
      return datastore.findUserById(userId);
    },
    async updateUserProfile(userId: string, profile: JsonRecord) {
      await ensureInitialized();
      await patchRows(
        "users",
        { id: `eq.${userId}` },
        {
          profile_json: JSON.stringify(profile || {})
        }
      );
      return datastore.findUserById(userId);
    },
    async updateUserRoleByUsername(username: string, role: string) {
      await ensureInitialized();
      await patchRows(
        "users",
        { username: `eq.${username}` },
        {
          role: role === "admin" ? "admin" : "user"
        }
      );
    },
    async createSession(token: string, userId: string, createdAt: number) {
      await ensureInitialized();
      await insertRow("sessions", {
        token,
        user_id: userId,
        created_at: createdAt || Date.now()
      });
    },
    async findSession(token: string) {
      await ensureInitialized();
      return normalizeSession(await selectOne<SessionRow>("sessions", { token: `eq.${token}` }));
    },
    async deleteSession(token: string) {
      await ensureInitialized();
      await deleteRows("sessions", { token: `eq.${token}` });
    },
    async listGames() {
      await ensureInitialized();
      return (await selectMany<GameRow>("games", {}, { order: "updated_at.desc" })).map((row) =>
        normalizeGame(row)
      );
    },
    async findGameById(gameId: string) {
      await ensureInitialized();
      return normalizeGame(await selectOne<GameRow>("games", { id: `eq.${gameId}` }));
    },
    async createGame(entry: GameRecord) {
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
      return datastore.findGameById(entry.id);
    },
    async updateGame(entry: GameRecord) {
      await ensureInitialized();
      const updated = await patchRows<GameRow>(
        "games",
        {
          id: `eq.${entry.id}`,
          version: `eq.${Number.isInteger(entry.version) && entry.version > 1 ? entry.version - 1 : 1}`
        },
        {
          name: entry.name,
          version: Number.isInteger(entry.version) && entry.version > 0 ? entry.version : 1,
          creator_user_id: entry.creatorUserId || null,
          state_json: JSON.stringify(entry.state || {}),
          updated_at: entry.updatedAt
        }
      );

      if (!updated.length) {
        const conflict = new Error(
          "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente."
        ) as VersionConflictError;
        conflict.code = "VERSION_CONFLICT";
        const current = await datastore.findGameById(entry.id);
        conflict.currentVersion = current ? current.version : null;
        conflict.currentState = current ? current.state : null;
        throw conflict;
      }

      return normalizeGame(updated[0] || null);
    },
    async deleteGame(gameId: string) {
      await ensureInitialized();
      await deleteRows("games", { id: `eq.${gameId}` });
      const activeGameId = await datastore.getActiveGameId();
      if (activeGameId === gameId) {
        await datastore.setActiveGameId(null);
      }
    },
    async getActiveGameId() {
      await ensureInitialized();
      const row = await selectOne<AppStateRow>("app_state", { key: "eq.activeGameId" });
      return row ? parseJson<string | null>(row.value_json, null) : null;
    },
    async getAppState(key: string) {
      await ensureInitialized();
      const row = await selectOne<AppStateRow>("app_state", { key: `eq.${String(key || "")}` });
      return row ? parseJson<unknown>(row.value_json, null) : null;
    },
    async setAppState(key: string, value: unknown) {
      await ensureInitialized();
      await upsertRows(
        "app_state",
        [
          {
            key: String(key || ""),
            value_json: JSON.stringify(value ?? null)
          }
        ],
        "key"
      );
      return datastore.getAppState(key);
    },
    async setActiveGameId(gameId: string | null) {
      await ensureInitialized();
      await upsertRows(
        "app_state",
        [
          {
            key: "activeGameId",
            value_json: JSON.stringify(gameId || null)
          }
        ],
        "key"
      );
    }
  } as const;

  return datastore;
}

module.exports = {
  createSupabaseDatastore
};
