const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const projectRoot = path.resolve(__dirname, "..", "..");

process.env.TEST = "true";
const {
  addPlayer,
  advanceTurn,
  applyReinforcement,
  applyFortify,
  awardTurnCardIfEligible,
  computeReinforcements,
  createInitialState,
  endTurn,
  forceEndTurn,
  getMapTerritories,
  moveAfterConquest,
  publicState,
  resolveAttack,
  startGame,
  territoriesOwnedBy,
  tradeCardSet,
  playerMustTradeCards
} = require("../backend/engine/game-engine.cjs");
const { chooseAttack, chooseFortify, runAiTurn } = require("../backend/engine/ai-player.cjs");
const {
  CardType,
  STANDARD_MAX_HAND_BEFORE_FORCED_TRADE,
  createCard,
  createStandardDeck,
  getCardRuleSet,
  standardTradeBonusForIndex,
  validateStandardCardSet
} = require("../shared/cards.cjs");
const {
  DEFENSE_THREE_DICE_RULE_SET_ID,
  STANDARD_DICE_RULE_SET_ID,
  getDiceRuleSet,
  listDiceRuleSets,
  standardDiceRuleSet
} = require("../shared/dice.cjs");
const { compareCombatDice, rollCombatDice } = require("../backend/engine/combat-dice.cjs");
const {
  DEFENSE_THREE_NEW_GAME_RULE_SET_ID,
  createConfiguredInitialState,
  listTurnTimeoutHoursOptions,
  validateNewGameConfig
} = require("../backend/new-game-config.cjs");
const { handleScheduledJobsRoute } = require("../backend/routes/scheduled-jobs.cjs");
const { runScheduledJobs } = require("../backend/scheduler/index.cjs");
const { recoverAiTurnState, recoverStuckAiTurns } = require("../backend/services/ai-turn-recovery.cjs");
const { enforceTurnTimeouts } = require("../backend/services/turn-timeout-enforcement.cjs");
const { createAuthStore } = require("../backend/auth.cjs");
const { createAuthRepository } = require("../backend/auth-repository.cjs");
const { createDatastore } = require("../backend/datastore.cjs");
const { createGameSessionStore } = require("../backend/game-session-store.cjs");
const { readJsonFile, writeJsonFile } = require("../backend/json-file-store.cjs");
const { createPlayerProfileStore } = require("../backend/player-profile-store.cjs");
const { missingRequiredDeployEnv, shouldValidateDeployEnv } = require("../backend/required-runtime-env.cjs");
const { createApp } = require("../backend/server.cjs");
const { sendJson, localizedPayload, sendLocalizedError } = require("../backend/http-response.cjs");
const { handleAuthSessionRoute, handleProfileRoute, handleThemePreferenceRoute } = require("../backend/routes/account.cjs");
const { handleGameActionRoute } = require("../backend/routes/game-actions.cjs");
const { handleAttackGameActionRoute } = require("../backend/routes/game-actions-attack.cjs");
const { handleBasicGameActionRoute } = require("../backend/routes/game-actions-basic.cjs");
const { handleTurnGameActionRoute } = require("../backend/routes/game-actions-turn.cjs");
const { handleCreateGameRoute, handleOpenGameRoute } = require("../backend/routes/game-management.cjs");
const { handleHealthRoute } = require("../backend/routes/health.cjs");
const { randomHex, secureRandom } = require("../backend/random.cjs");
const { pruneBackups } = require("./backup-datastore.cjs");
const { inspectBackup } = require("./check-backup.cjs");
const { checkThemeTokenization } = require("./check-theme-tokenization.cjs");
const classicMiniMap = require("../shared/maps/classic-mini.cjs");
const middleEarthMap = require("../shared/maps/middle-earth.cjs");
const worldClassicMap = require("../shared/maps/world-classic.cjs");
const { listSupportedMaps } = require("../shared/maps/index.cjs");

type TestFn = () => void | Promise<void>;
type TestCase = {
  name: string;
  fn: TestFn;
};
type HeaderMap = Record<string, string>;
type MockResponse = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
  writeHead(statusCode: number, nextHeaders?: HeaderMap): void;
  end(chunk?: string): void;
};
type CallAppResult = {
  statusCode: number;
  payload: any;
};
type FetchGameOptions = {
  method?: string;
  body?: any;
  headers?: HeaderMap;
};
type ServerTestContext = {
  app: any;
  tempFile: string;
  tempGamesFile: string;
  tempSessionsFile: string;
  tempDbFile: string;
};
type MockSupabaseData = {
  users?: any[];
  games?: any[];
  sessions?: any[];
  app_state?: any[];
};
interface Body {
  json(): Promise<any>;
}

const tests: TestCase[] = [];
const TEST_PASSWORD = "Secret123!";
const frontendI18nModulePromise = import(pathToFileURL(path.join(projectRoot, "public", "i18n.mjs")).href);

function register(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

function uniqueSuffix() {
  return randomHex(4);
}

function uniqueName(prefix: string) {
  return `${prefix}_${uniqueSuffix()}`;
}

function setupLobby() {
  const state = createInitialState();
  const first = addPlayer(state, "Alice");
  const second = addPlayer(state, "Bob");
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  return { state, first: first.player, second: second.player };
}

function makeMockResponse(): MockResponse {
  const headers: HeaderMap = {};
  return {
    statusCode: 200,
    headers,
    body: "",
    writeHead(statusCode: number, nextHeaders: HeaderMap = {}) {
      this.statusCode = statusCode;
      Object.assign(headers, nextHeaders);
    },
    end(chunk = "") {
      this.body += chunk || "";
    }
  };
}

async function callApp(app: any, method: string, pathname: string, body?: any, headers: HeaderMap = {}): Promise<CallAppResult> {
  const req = new (require("events").EventEmitter)();
  req.method = method;
  req.headers = { "content-type": "application/json", ...headers };
  req.destroy = () => {};
  const res = makeMockResponse();
  const promise = app.handleApi(req, res, new URL(`http://127.0.0.1${pathname}`));

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit("data", JSON.stringify(body));
    }
    req.emit("end");
  });

  await promise;
  return {
    statusCode: res.statusCode,
    payload: res.body ? JSON.parse(res.body) : null
  };
}

async function fetchGame(app: any, pathname: string, options: FetchGameOptions = {}): Promise<any> {
  return (await callApp(app, options.method || "GET", pathname, options.body, options.headers)).payload;
}

async function readJson(response: any): Promise<any> {
  return response.json();
}

function sessionTokenFromSetCookie(rawSetCookie: string | string[] | null | undefined): string {
  const value = Array.isArray(rawSetCookie) ? rawSetCookie.join("; ") : String(rawSetCookie || "");
  const match = value.match(/netrisk_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}


async function createAuthenticatedSession(baseUrl: string, username: string): Promise<any> {
  const password = TEST_PASSWORD;
  const registerResponse = await fetch(baseUrl + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  assert.equal(registerResponse.status, 201);

  const loginResponse = await fetch(baseUrl + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  assert.equal(loginResponse.status, 200);
  const payload: any = await loginResponse.json();
  return {
    ...payload,
    sessionToken: sessionTokenFromSetCookie(loginResponse.headers.get("set-cookie"))
  };
}

function authHeaders(sessionToken: string): HeaderMap {
  return {
    "Content-Type": "application/json",
    cookie: `netrisk_session=${encodeURIComponent(sessionToken)}`
  };
}

function readPublicHtml(fileName: string): string {
  return fs.readFileSync(path.join(projectRoot, "public", fileName), "utf8");
}

function readProjectJson(fileName: string): any {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, fileName), "utf8"));
}

register("frontend CSS usa solo token tema fuori dalla sezione definizioni", () => {
  checkThemeTokenization();
});

register("vercel build command compila TypeScript prima della sync degli asset", () => {
  const config = readProjectJson("vercel.json");
  assert.equal(typeof config.buildCommand, "string");
  assert.equal(config.buildCommand, "npm run build:ts");
});

register("game log merge mantiene la cronologia legacy quando arrivano entry localizzate", async () => {
  const { setLocale, translateGameLogEntries } = await frontendI18nModulePromise;
  setLocale("it", {
    storage: { setItem() {} },
    applyDocument: false
  });

  const snapshot = {
    logEntries: [
      {
        message: "Lobby creata. Unisciti e avvia la partita.",
        messageKey: "game.log.lobbyCreated",
        messageParams: {}
      }
    ],
    log: [
      "Lobby creata. Unisciti e avvia la partita.",
      "Partita iniziata",
      "Alice conquista Kamchatka"
    ]
  };

  assert.deepEqual(translateGameLogEntries(snapshot), [
    "Lobby creata. Unisciti e avvia la partita.",
    "Partita iniziata",
    "Alice conquista Kamchatka"
  ]);
});

function createMockSupabaseResponse(status: number, payload: any) {
  const text = payload == null ? "" : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return text;
    }
  };
}

function createMockSupabaseFetch(initialData: MockSupabaseData = {}) {
  const tables: Record<string, any[]> = {
    users: Array.isArray(initialData.users) ? initialData.users.map((row: any) => ({ ...row })) : [],
    games: Array.isArray(initialData.games) ? initialData.games.map((row: any) => ({ ...row })) : [],
    sessions: Array.isArray(initialData.sessions) ? initialData.sessions.map((row: any) => ({ ...row })) : [],
    app_state: Array.isArray(initialData.app_state) ? initialData.app_state.map((row: any) => ({ ...row })) : []
  };

  function parseFilter(rawValue: any) {
    const value = String(rawValue || "");
    const decodeLiteral = (input: string) => decodeURIComponent(input).replace(/\\([%_])/g, "$1");
    if (value.startsWith("eq.")) {
      return { operator: "eq", value: decodeLiteral(value.slice(3)) };
    }

    if (value.startsWith("ilike.")) {
      return { operator: "ilike", value: decodeLiteral(value.slice(6)) };
    }

    return { operator: "eq", value: decodeLiteral(value) };
  }

  function cloneRows(rows: any[]) {
    return rows.map((row: any) => ({ ...row }));
  }

  function applyFilters(rows: any[], searchParams: URLSearchParams) {
    return rows.filter((row: any) => {
      for (const [key, value] of searchParams.entries()) {
        if (key === "select" || key === "limit" || key === "order" || key === "on_conflict") {
          continue;
        }

        const filter = parseFilter(value);
        const candidate = String(row[key] ?? "");
        if (filter.operator === "ilike") {
          if (candidate.toLowerCase() !== filter.value.toLowerCase()) {
            return false;
          }
          continue;
        }

        if (candidate !== filter.value) {
          return false;
        }
      }

      return true;
    });
  }

  function applyOrdering(rows: any[], order: any) {
    if (!order) {
      return rows;
    }

    const [field, direction = "asc"] = String(order).split(".");
    const factor = direction === "desc" ? -1 : 1;
    return [...rows].sort((left, right) => {
      const a = String(left[field] ?? "");
      const b = String(right[field] ?? "");
      return a.localeCompare(b) * factor;
    });
  }

  function applySelection(rows: any[], select: any) {
    if (!select || select === "*") {
      return cloneRows(rows);
    }

    const fields = String(select)
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);

    return rows.map((row: any) => {
      const projected: Record<string, any> = {};
      fields.forEach((field: string) => {
        projected[field] = row[field];
      });
      return projected;
    });
  }

  async function fetchMock(url: string, init: any = {}) {
    const requestUrl = new URL(url);
    const tableName = requestUrl.pathname.split("/").pop() || "";
    const table = tables[tableName];
    if (!table) {
      return createMockSupabaseResponse(404, { error: "unknown_table" });
    }

    const method = String(init.method || "GET").toUpperCase();
    const searchParams = requestUrl.searchParams;

    if (method === "GET") {
      let rows = applyFilters(table, searchParams);
      rows = applyOrdering(rows, searchParams.get("order"));
      const limit = Number(searchParams.get("limit"));
      if (Number.isInteger(limit) && limit > 0) {
        rows = rows.slice(0, limit);
      }
      return createMockSupabaseResponse(200, applySelection(rows, searchParams.get("select")));
    }

    if (method === "POST") {
      const payload = JSON.parse(init.body || "[]");
      const rows = Array.isArray(payload) ? payload : [payload];
      const onConflict = searchParams.get("on_conflict");
      const inserted: any[] = [];

      rows.forEach((row: any) => {
        const nextRow = { ...row };
        if (onConflict) {
          const existingIndex = table.findIndex((candidate: any) => String(candidate[onConflict] ?? "") === String(nextRow[onConflict] ?? ""));
          if (existingIndex >= 0) {
            table[existingIndex] = { ...table[existingIndex], ...nextRow };
            inserted.push({ ...table[existingIndex] });
            return;
          }
        }

        table.push(nextRow);
        inserted.push({ ...nextRow });
      });

      return createMockSupabaseResponse(201, inserted);
    }

    if (method === "PATCH") {
      const patch = JSON.parse(init.body || "{}");
      const updated: any[] = [];
      table.forEach((row: any, index: number) => {
        const matches = applyFilters([row], searchParams).length === 1;
        if (!matches) {
          return;
        }

        table[index] = { ...row, ...patch };
        updated.push({ ...table[index] });
      });

      return createMockSupabaseResponse(200, updated);
    }

    if (method === "DELETE") {
      const remaining: any[] = [];
      table.forEach((row: any) => {
        const matches = applyFilters([row], searchParams).length === 1;
        if (!matches) {
          remaining.push(row);
        }
      });
      tables[tableName] = remaining;
      return createMockSupabaseResponse(204, null);
    }

    return createMockSupabaseResponse(405, { error: "unsupported_method" });
  }

  return {
    tables,
    fetch: fetchMock
  };
}

async function withMockSupabase(run: (mock: any) => Promise<void>, initialData: MockSupabaseData = {}) {
  const originalFetch: any = global.fetch;
  const envKeys = [
    "DATASTORE_DRIVER",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    "SUPABASE_DB_SCHEMA",
    "VERCEL"
  ];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const mock = createMockSupabaseFetch(initialData);

  process.env.DATASTORE_DRIVER = "supabase";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "publishable-test-key";
  process.env.SUPABASE_DB_SCHEMA = "public";
  delete process.env.VERCEL;
  global.fetch = mock.fetch as any;

  try {
    return await run(mock);
  } finally {
    global.fetch = originalFetch;
    envKeys.forEach((key) => {
      if (typeof originalEnv[key] === "undefined") {
        delete process.env[key];
        return;
      }
      process.env[key] = originalEnv[key];
    });
  }
}

register("auth repository supabase normalizza utenti, preferenze e sessioni", async () => {
  await withMockSupabase(async (mock) => {
    mock.tables.users.push({
      id: "legacy-user",
      username: "legacy_user",
      role: "admin",
      credentials_json: "{\"password\":{\"hash\":\"abc\"}}",
      profile_json: "{\"preferences\":{\"theme\":\"ember\"}}",
      created_at: "2024-01-02T03:04:05.000Z"
    });

    const repository = createAuthRepository({ driver: "supabase" });
    const listedUsers = await repository.listUsers();
    assert.equal(listedUsers.length, 1);
    assert.equal(listedUsers[0].role, "admin");
    assert.equal(listedUsers[0].profile.preferences.theme, "ember");
    assert.equal(listedUsers[0].credentials.password.hash, "abc");

    const foundByUsername = await repository.findUserByUsername("LEGACY_USER");
    assert.equal(foundByUsername.id, "legacy-user");

    const createdUser = await repository.createUser({
      id: "user-2",
      username: "supa_created",
      role: "user",
      profile: { displayName: "Supa" },
      credentials: { password: { hash: "hash-1" } },
      createdAt: "2024-05-06T07:08:09.000Z"
    });
    assert.equal(createdUser.username, "supa_created");
    assert.equal(createdUser.profile.displayName, "Supa");

    const updatedCredentials = await repository.updateUserCredentials("user-2", { password: { hash: "hash-2" } });
    assert.equal(updatedCredentials.credentials.password.hash, "hash-2");

    const updatedProfile = await repository.updateUserProfile("user-2", {
      displayName: "Updated Supa",
      preferences: { theme: "command" }
    });
    assert.equal(updatedProfile.profile.displayName, "Updated Supa");
    assert.equal(updatedProfile.profile.preferences.theme, "command");

    const updatedTheme = await repository.updateUserThemePreference("user-2", "midnight");
    assert.equal(updatedTheme.profile.preferences.theme, "midnight");
    assert.equal(updatedTheme.profile.displayName, "Updated Supa");

    await repository.createSession("token-1", "user-2", 987654321);
    const storedSession = await repository.findSession("token-1");
    assert.deepEqual(storedSession, {
      token: "token-1",
      user_id: "user-2",
      created_at: 987654321
    });

    await repository.deleteSession("token-1");
    assert.equal(await repository.findSession("token-1"), null);

    repository.close();
  });
});

register("auth repository locale delega aggiornamenti profilo, tema e sessioni", async () => {
  const calls: any[] = [];
  const localRepository = createAuthRepository({
    driver: "local",
    datastore: {
      async listUsers() {
        calls.push("listUsers");
        return [{ id: "u1" }];
      },
      async findUserByUsername(username: any) {
        calls.push(["findUserByUsername", username]);
        return { id: "u1", username };
      },
      async findUserById(userId: any) {
        calls.push(["findUserById", userId]);
        return { id: userId };
      },
      async createUser(user: any) {
        calls.push(["createUser", user.id]);
        return user;
      },
      async updateUserCredentials(userId: any, credentials: any) {
        calls.push(["updateUserCredentials", userId, credentials.password.hash]);
        return { id: userId, credentials };
      },
      async updateUserProfile(userId: any, profile: any) {
        calls.push(["updateUserProfile", userId, profile.displayName]);
        return { id: userId, profile };
      },
      async updateUserThemePreference(userId: any, theme: any) {
        calls.push(["updateUserThemePreference", userId, theme]);
        return { id: userId, profile: { preferences: { theme } } };
      },
      createSession(token: any, userId: any, createdAt: any) {
        calls.push(["createSession", token, userId, createdAt]);
      },
      findSession(token: any) {
        calls.push(["findSession", token]);
        return { token, userId: "u1", createdAt: 1234 };
      },
      deleteSession(token: any) {
        calls.push(["deleteSession", token]);
      },
      close() {
        calls.push("close");
      }
    }
  });

  assert.deepEqual(await localRepository.listUsers(), [{ id: "u1" }]);
  assert.deepEqual(await localRepository.findUserByUsername("alice"), { id: "u1", username: "alice" });
  assert.deepEqual(await localRepository.findUserById("u1"), { id: "u1" });
  assert.equal((await localRepository.createUser({ id: "u2", username: "bob" })).username, "bob");
  assert.equal((await localRepository.updateUserCredentials("u2", { password: { hash: "abc" } })).credentials.password.hash, "abc");
  assert.equal((await localRepository.updateUserProfile("u2", { displayName: "Bobby" })).profile.displayName, "Bobby");
  assert.equal((await localRepository.updateUserThemePreference("u2", "ember")).profile.preferences.theme, "ember");
  await localRepository.createSession("token-local", "u2", 55);
  assert.deepEqual(await localRepository.findSession("token-local"), {
    token: "token-local",
    user_id: "u1",
    created_at: 1234
  });
  await localRepository.deleteSession("token-local");
  localRepository.close();

  assert.equal(calls.some((entry: any) => Array.isArray(entry) && entry[0] === "updateUserProfile"), true);
  assert.equal(calls.some((entry: any) => Array.isArray(entry) && entry[0] === "updateUserThemePreference"), true);
  assert.equal(calls.includes("close"), true);
});

register("json file store usa backup e valida il payload letto", () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const tempDir = path.join(__dirname, "tmp-json-store", unique);
  const filePath = path.join(tempDir, "store.json");
  const backupPath = `${filePath}.bak`;

  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(filePath, "{ invalid json", "utf8");
  fs.writeFileSync(backupPath, JSON.stringify({ ok: true, source: "backup" }), "utf8");

  const recovered = readJsonFile(filePath, { ok: false }, (value: any) => value && value.ok === true);
  assert.deepEqual(recovered, { ok: true, source: "backup" });

  fs.writeFileSync(filePath, JSON.stringify({ ok: false }), "utf8");
  const fallback = readJsonFile(filePath, { ok: "fallback" }, (value: any) => value && value.ok === true);
  assert.deepEqual(fallback, { ok: "fallback" });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

register("json file store scrive backup del contenuto precedente", () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const tempDir = path.join(__dirname, "tmp-json-write", unique);
  const filePath = path.join(tempDir, "store.json");

  fs.mkdirSync(tempDir, { recursive: true });
  writeJsonFile(filePath, { version: 1, value: "before" });
  writeJsonFile(filePath, { version: 2, value: "after" });

  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), { version: 2, value: "after" });
  assert.deepEqual(JSON.parse(fs.readFileSync(`${filePath}.bak`, "utf8")), { version: 1, value: "before" });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

register("required runtime env valida solo preview e production su Vercel", () => {
  assert.equal(shouldValidateDeployEnv({}), false);
  assert.equal(shouldValidateDeployEnv({ VERCEL: "1", VERCEL_ENV: "development" }), false);
  assert.equal(shouldValidateDeployEnv({ VERCEL: "1", VERCEL_ENV: "preview" }), true);
  assert.equal(shouldValidateDeployEnv({ VERCEL: "1", VERCEL_ENV: "production" }), true);

  assert.deepEqual(
    missingRequiredDeployEnv({
      AUTH_ENCRYPTION_KEY: "enc",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "",
      DATASTORE_DRIVER: "supabase"
    }),
    ["SUPABASE_SERVICE_ROLE_KEY"]
  );
});

register("player profile store riassume vittorie, sconfitte e partite in corso", async () => {
  const playerProfiles = createPlayerProfileStore({
    datastore: {
      listGames() {
        return [
          {
            id: "active-2",
            name: "Più recente",
            updatedAt: "2026-04-10T10:00:00.000Z",
            state: {
              phase: "active",
              currentTurnIndex: 0,
              turnPhase: "attack",
              players: [
                { id: "p1", name: "Alice", surrendered: false },
                { id: "p2", name: "Bob", surrendered: false }
              ],
              territories: {
                alpha: { ownerId: "p1" },
                beta: { ownerId: "p1" },
                gamma: { ownerId: "p2" }
              },
              hands: { p1: [{ id: "c1" }, { id: "c2" }] },
              gameConfig: { totalPlayers: 2, mapId: "world-classic" }
            }
          },
          {
            id: "active-1",
            name: "Lobby recente",
            updatedAt: "2026-04-09T09:00:00.000Z",
            state: {
              phase: "lobby",
              players: [{ id: "p1", name: "Alice", surrendered: false }],
              territories: {},
              hands: {},
              gameConfig: { totalPlayers: 3, mapName: "Custom Lobby" }
            }
          },
          {
            id: "finished-win",
            name: "Win",
            updatedAt: "2026-04-01T09:00:00.000Z",
            state: {
              phase: "finished",
              winnerId: "p1",
              players: [
                { id: "p1", name: "Alice", surrendered: false },
                { id: "p2", name: "Bob", surrendered: false }
              ],
              territories: { alpha: { ownerId: "p1" } }
            }
          },
          {
            id: "finished-loss",
            name: "Loss",
            updatedAt: "2026-03-01T09:00:00.000Z",
            state: {
              phase: "finished",
              winnerId: "p2",
              players: [
                { id: "p1", name: "Alice", surrendered: true },
                { id: "p2", name: "Bob", surrendered: false }
              ],
              territories: { alpha: { ownerId: "p2" } }
            }
          }
        ];
      }
    }
  });

  const profile = await playerProfiles.getPlayerProfile("Alice");
  assert.equal(profile.playerName, "Alice");
  assert.equal(profile.gamesPlayed, 2);
  assert.equal(profile.wins, 1);
  assert.equal(profile.losses, 1);
  assert.equal(profile.gamesInProgress, 2);
  assert.equal(profile.winRate, 50);
  assert.deepEqual(profile.participatingGames.map((game: any) => game.id), ["active-2", "active-1"]);
  assert.equal(profile.participatingGames[0].myLobby.focusLabel, "Tocca a te");
  assert.equal(profile.participatingGames[0].myLobby.statusLabel, "Operativo");
  assert.equal(profile.participatingGames[0].myLobby.cardCount, 2);
  assert.equal(profile.participatingGames[1].myLobby.focusLabel, "Lobby");
  assert.equal(profile.participatingGames[1].mapName, "Custom Lobby");
});

register("http response helpers normalizzano payload localizzati e codici extra", () => {
  assert.deepEqual(
    localizedPayload(
      {
        message: "Messaggio dal server",
        messageKey: "server.message",
        messageParams: { scope: "test" }
      },
      "Fallback",
      "server.fallback"
    ),
    {
      error: "Messaggio dal server",
      messageKey: "server.message",
      messageParams: { scope: "test" }
    }
  );

  const res = makeMockResponse();
  sendLocalizedError(
    res,
    409,
    null,
    "Conflict",
    "server.versionConflict",
    { currentVersion: 3 },
    "VERSION_CONFLICT",
    { retryable: true }
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.headers["Content-Type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(res.body), {
    error: "Conflict",
    messageKey: "server.versionConflict",
    messageParams: { currentVersion: 3 },
    code: "VERSION_CONFLICT",
    retryable: true
  });
});

register("health route usa 503 quando lo snapshot segnala errore", async () => {
  const res = makeMockResponse();
  const handled = await handleHealthRoute(
    res,
    async () => ({ ok: false, storage: { storage: "sqlite" } }),
    sendJson
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(JSON.parse(res.body), {
    ok: false,
    storage: { storage: "sqlite" }
  });
});

register("account routes rispondono con sessione, profilo e validazione tema", async () => {
  const authContext = {
    user: {
      id: "user-1",
      username: "Alice",
      preferences: { theme: "ember" }
    }
  };

  const sessionRes = makeMockResponse();
  const sessionHandled = await handleAuthSessionRoute({
    req: { method: "GET", headers: {} },
    res: sessionRes,
    requireAuth: async () => authContext,
    auth: {
      publicUser(user: any) {
        return {
          id: user.id,
          username: user.username,
          preferences: user.preferences
        };
      },
      async updateUserThemePreference() {
        return null;
      }
    },
    playerProfiles: {
      async getPlayerProfile() {
        return {};
      }
    },
    sendJson,
    sendLocalizedError,
      extractUserPreferences(user: any) {
      return { theme: user?.preferences?.theme || "command" };
    },
    supportedSiteThemes: new Set(["command", "midnight", "ember"]),
      resolveStoredTheme(theme: any) {
      return theme;
    }
  });

  assert.equal(sessionHandled, true);
  assert.equal(sessionRes.statusCode, 200);
  assert.deepEqual(JSON.parse(sessionRes.body), {
    user: {
      id: "user-1",
      username: "Alice",
      preferences: { theme: "ember" }
    }
  });

  const profileRes = makeMockResponse();
  const profileHandled = await handleProfileRoute({
    req: { method: "GET", headers: {} },
    res: profileRes,
    requireAuth: async () => authContext,
    auth: {
      publicUser() {
        return null;
      },
      async updateUserThemePreference() {
        return null;
      }
    },
    playerProfiles: {
      async getPlayerProfile() {
        return {
          playerName: "Alice",
          gamesPlayed: 3,
          wins: 2,
          losses: 1,
          gamesInProgress: 1,
          participatingGames: [],
          winRate: 67,
          hasHistory: true,
          placeholders: {
            recentGames: false,
            ranking: false
          }
        };
      }
    },
    sendJson,
    sendLocalizedError,
      extractUserPreferences(user: any) {
      return { theme: user?.preferences?.theme || "command" };
    },
    supportedSiteThemes: new Set(["command", "midnight", "ember"]),
      resolveStoredTheme(theme: any) {
      return theme;
    }
  });

  assert.equal(profileHandled, true);
  assert.equal(profileRes.statusCode, 200);
  assert.equal(JSON.parse(profileRes.body).profile.preferences.theme, "ember");

  const invalidThemeRes = makeMockResponse();
  const invalidThemeHandled = await handleThemePreferenceRoute({
    req: { method: "PUT", headers: {} },
    res: invalidThemeRes,
    requireAuth: async () => authContext,
    auth: {
      publicUser() {
        return null;
      },
      async updateUserThemePreference() {
        return null;
      }
    },
    playerProfiles: {
      async getPlayerProfile() {
        return {};
      }
    },
    sendJson,
    sendLocalizedError,
    extractUserPreferences() {
      return { theme: "command" };
    },
    supportedSiteThemes: new Set(["command", "midnight", "ember"]),
      resolveStoredTheme(theme: any) {
      return theme;
    }
  }, { theme: "ultraviolet" });

  assert.equal(invalidThemeHandled, true);
  assert.equal(invalidThemeRes.statusCode, 400);
  assert.equal(JSON.parse(invalidThemeRes.body).messageKey, "server.profile.invalidTheme");
});

register("basic game action route gestisce reinforce e persiste lo snapshot per-user", async () => {
  const res = makeMockResponse();
  const gameContext = {
    state: { territories: { alpha: { ownerId: "p1", armies: 3 } } },
    gameId: "game-basic",
    version: 2,
    gameName: "Basic Route"
  };
  const user = { id: "user-1", username: "Alice" };
  const persisted: any[] = [];
  const broadcasts: any[] = [];

  const handled = await handleBasicGameActionRoute(
    "reinforce",
    res,
    { territoryId: "alpha", amount: 2 },
    gameContext,
    "p1",
    2,
    user,
    (state: any, playerId: any, territoryId: any, amount: any) => {
      assert.equal(playerId, "p1");
      assert.equal(territoryId, "alpha");
      assert.equal(amount, 2);
      state.territories.alpha.armies += amount;
      return { ok: true };
    },
    () => {
      throw new Error("moveAfterConquest should not be called");
    },
    () => {
      throw new Error("applyFortify should not be called");
    },
    async (context: any, expectedVersion: any) => {
      persisted.push({ context, expectedVersion });
      context.version = 3;
    },
    (context: any) => {
      broadcasts.push(context.version);
    },
    (state: any, gameId: any, version: any, gameName: any, currentUser: any) => ({
      gameId,
      version,
      gameName,
      armies: state.territories.alpha.armies,
      playerId: currentUser.id
    }),
    () => false,
    (territoryId: any) => territoryId === "alpha",
    sendJson,
    sendLocalizedError
  );

  assert.equal(handled, true);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].expectedVersion, 2);
  assert.deepEqual(broadcasts, [3]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    ok: true,
    state: {
      gameId: "game-basic",
      version: 3,
      gameName: "Basic Route",
      armies: 5,
      playerId: "user-1"
    }
  });
});

register("basic game action route valida i territori nel fortify", async () => {
  const res = makeMockResponse();
  const handled = await handleBasicGameActionRoute(
    "fortify",
    res,
    { fromId: "invalid", toId: "beta", armies: 1 },
    {
      state: { territories: { alpha: {}, beta: {} } },
      gameId: "game-basic",
      version: 1,
      gameName: "Basic Route"
    },
    "p1",
    1,
    { id: "user-1" },
    () => {
      throw new Error("applyReinforcement should not be called");
    },
    () => {
      throw new Error("moveAfterConquest should not be called");
    },
    () => {
      throw new Error("applyFortify should not be called");
    },
    async () => {
      throw new Error("persistGameContext should not be called");
    },
    () => {
      throw new Error("broadcastGame should not be called");
    },
    () => {
      throw new Error("snapshotForUser should not be called");
    },
    () => false,
    (territoryId: any) => territoryId === "alpha" || territoryId === "beta",
    sendJson,
    sendLocalizedError
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(JSON.parse(res.body), {
    error: "Territorio non valido.",
    messageKey: "game.invalidTerritory",
    messageParams: {},
    code: null
  });
});

register("attack game action route gestisce un attacco con random consumato dalla queue", async () => {
  const res = makeMockResponse();
  const gameContext = {
    state: { territories: { alpha: {}, beta: {} } },
    gameId: "game-attack",
    version: 5,
    gameName: "Attack Route"
  };
  const persisted: any[] = [];
  const broadcasts: any[] = [];
  let consumeCount = 0;

  const handled = await handleAttackGameActionRoute(
    "attack",
    res,
    { fromId: "alpha", toId: "beta", attackDice: "3" },
    gameContext,
    "p1",
    5,
    { id: "user-1" },
    (state: any, playerId: any, fromId: any, toId: any, random: any, attackDice: any) => {
      assert.equal(playerId, "p1");
      assert.equal(fromId, "alpha");
      assert.equal(toId, "beta");
      assert.equal(attackDice, 3);
      assert.equal(typeof random, "function");
      assert.equal(random(), 0.25);
      state.lastAttack = { fromId, toId };
      return { ok: true, rounds: [{ attack: 6, defend: 2 }] };
    },
    () => {
      throw new Error("resolveBanzaiAttack should not be called");
    },
    () => {
      consumeCount += 1;
      return () => 0.25;
    },
    async (context: any, expectedVersion: any) => {
      persisted.push(expectedVersion);
      context.version = 6;
    },
    (context: any) => {
      broadcasts.push(context.version);
    },
    (state: any, gameId: any, version: any, gameName: any, user: any) => ({
      gameId,
      version,
      gameName,
      lastAttack: state.lastAttack,
      playerId: user.id
    }),
    () => false,
    (territoryId: any) => territoryId === "alpha" || territoryId === "beta",
    sendJson,
    sendLocalizedError
  );

  assert.equal(handled, true);
  assert.equal(consumeCount, 1);
  assert.deepEqual(persisted, [5]);
  assert.deepEqual(broadcasts, [6]);
  assert.deepEqual(JSON.parse(res.body), {
    ok: true,
    state: {
      gameId: "game-attack",
      version: 6,
      gameName: "Attack Route",
      lastAttack: { fromId: "alpha", toId: "beta" },
      playerId: "user-1"
    },
    rounds: [{ attack: 6, defend: 2 }]
  });
});

register("attack game action route valida i territori prima del banzai", async () => {
  const res = makeMockResponse();
  const handled = await handleAttackGameActionRoute(
    "attackBanzai",
    res,
    { fromId: "alpha", toId: "missing" },
    {
      state: { territories: { alpha: {}, beta: {} } },
      gameId: "game-attack",
      version: 5,
      gameName: "Attack Route"
    },
    "p1",
    5,
    { id: "user-1" },
    () => {
      throw new Error("resolveAttack should not be called");
    },
    () => {
      throw new Error("resolveBanzaiAttack should not be called");
    },
    () => null,
    async () => {
      throw new Error("persistGameContext should not be called");
    },
    () => {
      throw new Error("broadcastGame should not be called");
    },
    () => {
      throw new Error("snapshotForUser should not be called");
    },
    () => false,
    (territoryId: any) => territoryId === "alpha" || territoryId === "beta",
    sendJson,
    sendLocalizedError
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(JSON.parse(res.body), {
    error: "Territorio non valido.",
    messageKey: "game.invalidTerritory",
    messageParams: {},
    code: null
  });
});

register("turn game action route gestisce endTurn con persistenza AI-aware", async () => {
  const res = makeMockResponse();
  const gameContext = {
    state: { phase: "active", turnPhase: "attack" },
    gameId: "game-turn",
    version: 7,
    gameName: "Turn Route"
  };
  const persisted: any[] = [];
  const broadcasts: any[] = [];

  const handled = await handleTurnGameActionRoute(
    "endTurn",
    res,
    gameContext,
    "p1",
    7,
    { id: "user-1" },
    (state: any, playerId: any) => {
      assert.equal(playerId, "p1");
      state.turnPhase = "reinforcement";
      return { ok: true };
    },
    () => {
      throw new Error("surrenderPlayer should not be called");
    },
    async (context: any, expectedVersion: any) => {
      persisted.push({ context, expectedVersion });
      context.version = 8;
    },
    (context: any) => {
      broadcasts.push(context.version);
    },
    (state: any, gameId: any, version: any, gameName: any, user: any) => ({
      gameId,
      version,
      gameName,
      phase: state.turnPhase,
      playerId: user.id
    }),
    () => false,
    sendJson,
    sendLocalizedError
  );

  assert.equal(handled, true);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].expectedVersion, 7);
  assert.deepEqual(broadcasts, [8]);
  assert.deepEqual(JSON.parse(res.body), {
    ok: true,
    state: {
      gameId: "game-turn",
      version: 8,
      gameName: "Turn Route",
      phase: "reinforcement",
      playerId: "user-1"
    }
  });
});

register("turn game action route gestisce surrender con version conflict", async () => {
  const res = makeMockResponse();
  const handled = await handleTurnGameActionRoute(
    "surrender",
    res,
    {
      state: { players: [] },
      gameId: "game-turn",
      version: 4,
      gameName: "Turn Route"
    },
    "p1",
    4,
    { id: "user-1" },
    () => {
      throw new Error("endTurn should not be called");
    },
    () => ({ ok: true }),
    async () => {
      throw { code: "VERSION_CONFLICT" };
    },
    () => {
      throw new Error("broadcastGame should not be called");
    },
    () => {
      throw new Error("snapshotForUser should not be called");
    },
    (error: any) => {
      sendJson(res, 409, { ok: false, code: error.code });
      return true;
    },
    sendJson,
    sendLocalizedError
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(JSON.parse(res.body), {
    ok: false,
    code: "VERSION_CONFLICT"
  });
});

register("game management route crea una partita e collega il creatore", async () => {
  const res = makeMockResponse();
  const broadcasts: any[] = [];
  let replacedState: any = null;

  await handleCreateGameRoute(
    { method: "POST", headers: {} },
    res,
    { name: "Nuova partita" },
    async () => ({ user: { id: "user-1", username: "Alice" } }),
    () => ({ actor: { id: "user-1" } }),
    () => ({
      state: { phase: "lobby", players: [] },
      gameInput: { name: "Nuova partita" },
      config: { mapId: "classic-mini" }
    }),
    (state: any, username: any, options: any) => {
      assert.equal(username, "Alice");
      assert.equal(options.linkedUserId, "user-1");
      state.players.push({ id: "player-1", name: username });
      return { ok: true, player: { id: "player-1" } };
    },
    async (state: any, options: any) => ({
      game: { id: "game-1", name: options.name, version: 1 },
      state
    }),
    async () => [{ id: "game-1", name: "Nuova partita" }],
    (state: any) => {
      replacedState = state;
    },
    (context: any) => {
      broadcasts.push(context.gameId);
    },
    () => ({ snapshot: true }),
    sendJson,
    sendLocalizedError
  );

  assert.equal(replacedState.phase, "lobby");
  assert.deepEqual(broadcasts, ["game-1"]);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(JSON.parse(res.body), {
    ok: true,
    game: { id: "game-1", name: "Nuova partita", version: 1 },
    games: [{ id: "game-1", name: "Nuova partita" }],
    activeGameId: "game-1",
    state: { snapshot: true },
    config: { mapId: "classic-mini" },
    playerId: "player-1"
  });
});

register("game management route apre una partita e risolve il player autenticato", async () => {
  const res = makeMockResponse();

  await handleOpenGameRoute(
    { method: "POST", headers: {} },
    res,
    { gameId: "game-1" },
    async () => ({ user: { id: "user-1", username: "Alice" } }),
    () => undefined,
    async (gameId: any) => ({
      game: { id: gameId, name: "Nuova partita", version: 3 },
      state: { players: [] }
    }),
    async (gameId: any) => ({
      game: { id: gameId, name: "Nuova partita", version: 3 },
      state: { players: [{ id: "player-1", linkedUserId: "user-1" }] }
    }),
    async () => [{ id: "game-1", name: "Nuova partita" }],
    async (gameContext: any) => {
      gameContext.game.version = 4;
      gameContext.state.players.push({ id: "ai-2", linkedUserId: null, isAi: true });
      return { shouldPersist: true, forcedTurn: false };
    },
    (state: any, user: any) => state.players.find((player: any) => player.linkedUserId === user.id) || null,
    (state: any, gameId: any, version: any, gameName: any) => ({
      gameId,
      version,
      gameName,
      players: state.players.length
    }),
    sendJson,
    sendLocalizedError
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    ok: true,
    game: { id: "game-1", name: "Nuova partita", version: 4 },
    games: [{ id: "game-1", name: "Nuova partita" }],
    activeGameId: "game-1",
    state: {
      gameId: "game-1",
      version: 4,
      gameName: "Nuova partita",
      players: 2
    },
    playerId: "player-1"
  });
});

register("game action route segnala il version conflict prima di eseguire mutazioni", async () => {
  const res = makeMockResponse();

  await handleGameActionRoute({
    req: { method: "POST", headers: {} },
    res,
    body: { playerId: "player-1", type: "reinforce", expectedVersion: 2 },
    url: new URL("http://127.0.0.1/api/action"),
    requireAuth: async () => ({ user: { id: "user-1", username: "Alice" } }),
    loadGameContext: async () => ({
      state: { territories: { alpha: {} }, players: [{ id: "player-1", linkedUserId: "user-1" }] },
      gameId: "game-1",
      version: 3,
      gameName: "Nuova partita"
    }),
    getTargetGameId: () => "game-1",
    playerBelongsToUser: () => true,
    persistGameContext: async () => {
      throw new Error("persistGameContext should not be called");
    },
    persistWithAiTurns: async () => {
      throw new Error("persistWithAiTurns should not be called");
    },
    broadcastGame: () => {
      throw new Error("broadcastGame should not be called");
    },
    snapshotForUser: (state: any, gameId: any, version: any, gameName: any, user: any) => ({
      gameId,
      version,
      gameName,
      playerId: user.id,
      territories: Object.keys(state.territories).length
    }),
    consumeQueuedAttackRandom: () => null,
    localizedPayload,
    sendJson,
    sendLocalizedError
  });

  assert.equal(res.statusCode, 409);
  assert.deepEqual(JSON.parse(res.body), {
    error: "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.",
    messageKey: "server.versionConflict",
    messageParams: {},
    code: "VERSION_CONFLICT",
    currentVersion: 3,
    state: {
      gameId: "game-1",
      version: 3,
      gameName: "Nuova partita",
      playerId: "user-1",
      territories: 1
    }
  });
});

register("game action route rifiuta player non associato all'utente", async () => {
  const res = makeMockResponse();

  await handleGameActionRoute({
    req: { method: "POST", headers: {} },
    res,
    body: { playerId: "player-2", type: "endTurn" },
    url: new URL("http://127.0.0.1/api/action"),
    requireAuth: async () => ({ user: { id: "user-1", username: "Alice" } }),
    loadGameContext: async () => ({
      state: { territories: {}, players: [{ id: "player-2", linkedUserId: "other-user" }] },
      gameId: "game-1",
      version: 3,
      gameName: "Nuova partita"
    }),
    getTargetGameId: () => "game-1",
    playerBelongsToUser: () => false,
    persistGameContext: async () => {
      throw new Error("persistGameContext should not be called");
    },
    persistWithAiTurns: async () => {
      throw new Error("persistWithAiTurns should not be called");
    },
    broadcastGame: () => {
      throw new Error("broadcastGame should not be called");
    },
    snapshotForUser: () => {
      throw new Error("snapshotForUser should not be called");
    },
    consumeQueuedAttackRandom: () => null,
    localizedPayload,
    sendJson,
    sendLocalizedError
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(JSON.parse(res.body), {
    error: "Giocatore non valido.",
    messageKey: "game.invalidPlayer",
    messageParams: {},
    code: null
  });
});

async function createAuthenticatedAppSession(app: any, username: string): Promise<any> {
  const registered = await app.auth.registerPasswordUser(username, TEST_PASSWORD);
  assert.equal(registered.ok, true);
  const login = await app.auth.loginWithPassword(username, TEST_PASSWORD);
  assert.equal(login.ok, true);
  return login;
}

function setStoredUserRole(datastore: any, username: string, role: string) {
  datastore.updateUserRoleByUsername(username, role);
  const target = datastore.findUserByUsername(username);
  assert.equal(Boolean(target), true);
  assert.equal(target.role, role);
}

function cleanupSqliteFiles(filePath: string) {
  [filePath, `${filePath}-wal`, `${filePath}-shm`].forEach((target) => {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  });
}

async function withServer(run: (baseUrl: string, context: ServerTestContext) => Promise<void>): Promise<void> {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const tempFile = path.join(__dirname, `tmp-users-${Date.now()}-${uniqueSuffix()}.json`);
  const tempGamesFile = path.join(__dirname, `tmp-games-${Date.now()}-${uniqueSuffix()}.json`);
  const tempSessionsFile = path.join(__dirname, `tmp-sessions-${Date.now()}-${uniqueSuffix()}.json`);
  const tempDbFile = path.join(__dirname, `tmp-store-${unique}.sqlite`);
  const app = createApp({ dataFile: tempFile, gamesFile: tempGamesFile, sessionsFile: tempSessionsFile, dbFile: tempDbFile });
  const listener = app.server.listen(0);

  await new Promise<void>((resolve, reject) => {
    listener.once("listening", resolve);
    listener.once("error", reject);
  });

  try {
    const address = listener.address() as { port: number };
    return await run(`http://127.0.0.1:${address.port}`, { app, tempFile, tempGamesFile, tempSessionsFile, tempDbFile });
  } finally {
    await new Promise<void>((resolve) => {
      if (!listener.listening) {
        resolve();
        return;
      }

      listener.close(() => resolve());
    });

    app.datastore.close();

    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    if (fs.existsSync(tempGamesFile)) {
      fs.unlinkSync(tempGamesFile);
    }

    if (fs.existsSync(tempSessionsFile)) {
      fs.unlinkSync(tempSessionsFile);
    }

    cleanupSqliteFiles(tempDbFile);
  }
}

register("auth store registra e autentica utenti password", async () => {
  const tempFile = path.join(__dirname, "tmp-users.json");
  const tempSessionsFile = path.join(__dirname, "tmp-sessions.json");
  const tempDbFile = path.join(__dirname, "tmp-auth.sqlite");
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }

  if (fs.existsSync(tempSessionsFile)) {
    fs.unlinkSync(tempSessionsFile);
  }

  if (fs.existsSync(tempDbFile)) {
    fs.unlinkSync(tempDbFile);
  }

  const auth = createAuthStore({
    dataFile: tempFile,
    sessionsFile: tempSessionsFile,
    dbFile: tempDbFile,
    encryptionKey: "test-auth-encryption-key"
  });
  const registered = await auth.registerPasswordUser({
    username: "tester",
    password: TEST_PASSWORD,
    email: "tester@example.com"
  });
  assert.equal(registered.ok, true);

  const login = await auth.loginWithPassword("tester", TEST_PASSWORD);
  assert.equal(login.ok, true);
  assert.equal(Boolean(login.sessionToken), true);
  assert.equal((await auth.getUserFromSession(login.sessionToken)).username, "tester");
  const storedUser = await auth.datastore.findUserByUsername("tester");
  assert.equal(typeof storedUser.credentials.password.secret, "undefined");
  assert.equal(typeof storedUser.credentials.password.hash, "string");
  assert.equal(storedUser.credentials.password.algorithm, "scrypt");
  assert.equal(typeof storedUser.profile.contact.emailEncrypted, "string");

  auth.datastore.close();
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
  if (fs.existsSync(tempSessionsFile)) {
    fs.unlinkSync(tempSessionsFile);
  }
  cleanupSqliteFiles(tempDbFile);
});

register("i form di login pubblici usano POST per non esporre credenziali nella query string", () => {
  const headerLoginPages = [
    "game.html",
    "lobby.html",
    "new-game.html",
    "profile.html",
    "register.html"
  ];

  headerLoginPages.forEach((fileName) => {
    const html = readPublicHtml(fileName);
    assert.match(
      html,
      /<form id="header-login-form"[^>]*method="post"/,
      `${fileName} deve usare POST per il form di login header`
    );
  });

  const gameHtml = readPublicHtml("game.html");
  assert.match(
    gameHtml,
    /<form id="auth-form"[^>]*method="post"/,
    "game.html deve usare POST per il form login principale"
  );
});

register("secureRandom restituisce un numero compreso tra 0 incluso e 1 escluso", () => {
  for (let index = 0; index < 32; index += 1) {
    const value = secureRandom();
    assert.equal(value >= 0, true);
    assert.equal(value < 1, true);
  }
});

register("randomHex restituisce una stringa esadecimale della lunghezza attesa", () => {
  const token = randomHex(6);
  assert.equal(token.length, 12);
  assert.match(token, /^[0-9a-f]+$/);
});

register("auth store mantiene la sessione dopo il riavvio del processo", async () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const tempFile = path.join(__dirname, `tmp-users-${unique}.json`);
  const tempSessionsFile = path.join(__dirname, `tmp-sessions-${unique}.json`);
  const tempDbFile = path.join(__dirname, `tmp-auth-${unique}.sqlite`);

  try {
    const firstStore = createAuthStore({ dataFile: tempFile, sessionsFile: tempSessionsFile, dbFile: tempDbFile });
    const registered = await firstStore.registerPasswordUser("persisted", TEST_PASSWORD);
    assert.equal(registered.ok, true);

    const login = await firstStore.loginWithPassword("persisted", TEST_PASSWORD);
    assert.equal(login.ok, true);

    const restartedStore = createAuthStore({ dataFile: tempFile, sessionsFile: tempSessionsFile, dbFile: tempDbFile });
    const user = await restartedStore.getUserFromSession(login.sessionToken);
    assert.equal(Boolean(user), true);
    assert.equal(user.username, "persisted");
    firstStore.datastore.close();
    restartedStore.datastore.close();
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    if (fs.existsSync(tempSessionsFile)) {
      fs.unlinkSync(tempSessionsFile);
    }

    cleanupSqliteFiles(tempDbFile);
  }
});

register("auth store migra password legacy in hash al login riuscito", async () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const tempFile = path.join(__dirname, `tmp-users-${unique}.json`);
  const tempSessionsFile = path.join(__dirname, `tmp-sessions-${unique}.json`);
  const tempDbFile = path.join(__dirname, `tmp-auth-${unique}.sqlite`);

  try {
    fs.writeFileSync(tempFile, JSON.stringify([{
      id: "legacy-user",
      username: "legacy",
      credentials: {
        password: {
          secret: "longpassword123"
        }
      },
      role: "user",
      profile: {
        displayName: "legacy"
      },
      createdAt: new Date().toISOString()
    }], null, 2) + "\n", "utf8");

    const auth = createAuthStore({ dataFile: tempFile, sessionsFile: tempSessionsFile, dbFile: tempDbFile });
    const login = await auth.loginWithPassword("legacy", "longpassword123");
    assert.equal(login.ok, true);

    const storedUser = await auth.datastore.findUserByUsername("legacy");
    assert.equal(typeof storedUser.credentials.password.secret, "undefined");
    assert.equal(typeof storedUser.credentials.password.hash, "string");
    assert.equal(typeof storedUser.credentials.password.salt, "string");
    assert.equal(storedUser.credentials.password.algorithm, "scrypt");
    auth.datastore.close();
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    if (fs.existsSync(tempSessionsFile)) {
      fs.unlinkSync(tempSessionsFile);
    }

    cleanupSqliteFiles(tempDbFile);
  }
});

register("auth store accetta email opzionale ma rifiuta password debole", async () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const tempFile = path.join(__dirname, `tmp-users-${unique}.json`);
  const tempSessionsFile = path.join(__dirname, `tmp-sessions-${unique}.json`);
  const tempDbFile = path.join(__dirname, `tmp-auth-${unique}.sqlite`);
  let auth = null;

  try {
    auth = createAuthStore({
      dataFile: tempFile,
      sessionsFile: tempSessionsFile,
      dbFile: tempDbFile,
      encryptionKey: "test-auth-encryption-key"
    });

    const weak = await auth.registerPasswordUser({
      username: "weak-user",
      password: "123",
      email: "weak@example.com"
    });
    assert.equal(weak.ok, false);

    const noEmail = await auth.registerPasswordUser({
      username: "solid-user",
      password: TEST_PASSWORD
    });
    assert.equal(noEmail.ok, true);

    const withEmail = await auth.registerPasswordUser({
      username: "solid-mail",
      password: TEST_PASSWORD,
      email: "solid@example.com"
    });
    assert.equal(withEmail.ok, true);

    const storedUser = await auth.datastore.findUserByUsername("solid-mail");
    assert.equal(Boolean(storedUser.profile.contact.emailEncrypted), true);
    assert.equal(storedUser.profile.contact.emailEncrypted.includes("solid@example.com"), false);
  } finally {
    if (auth) {
      auth.datastore.close();
    }

    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    if (fs.existsSync(tempSessionsFile)) {
      fs.unlinkSync(tempSessionsFile);
    }

    cleanupSqliteFiles(tempDbFile);
  }
});

register("datastore backup crea uno snapshot sqlite leggibile", async () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const sourceDbFile = path.join(__dirname, `tmp-backup-${unique}.sqlite`);
  const targetDbFile = path.join(__dirname, `tmp-backup-copy-${unique}.sqlite`);
  const legacyUsersFile = path.join(__dirname, `tmp-legacy-users-${unique}.json`);
  const legacyGamesFile = path.join(__dirname, `tmp-legacy-games-${unique}.json`);
  const legacySessionsFile = path.join(__dirname, `tmp-legacy-sessions-${unique}.json`);
  const datastore = createDatastore({ dbFile: sourceDbFile, legacyUsersFile, legacyGamesFile, legacySessionsFile });

  try {
    datastore.createUser({
      id: "backup-user",
      username: "backup-user",
      role: "user",
      profile: { displayName: "Backup User" },
      credentials: { password: { hash: "x", salt: "y", iterations: 1, digest: "sha256" } },
      createdAt: new Date().toISOString()
    });
    datastore.createSession("backup-session", "backup-user", Date.now());
    datastore.createGame({
      id: "backup-game",
      name: "Backup Game",
      version: 1,
      creatorUserId: "backup-user",
      state: createInitialState(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    datastore.setActiveGameId("backup-game");

    const backup = await datastore.backupTo(targetDbFile);
    assert.equal(backup.targetFile, targetDbFile);

    const restored = createDatastore({ dbFile: targetDbFile, legacyUsersFile, legacyGamesFile, legacySessionsFile });
    try {
      const health = restored.healthSummary();
      assert.equal(health.ok, true);
      assert.equal(health.counts.users, 1);
      assert.equal(health.counts.games, 1);
      assert.equal(health.counts.sessions, 1);
      assert.equal(restored.getActiveGameId(), "backup-game");
    } finally {
      restored.close();
    }
  } finally {
    datastore.close();
    cleanupSqliteFiles(sourceDbFile);
    cleanupSqliteFiles(targetDbFile);
  }
});

register("backup retention mantiene solo gli snapshot piu recenti", () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const backupDir = path.join(__dirname, `tmp-backups-${unique}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const files = [
    "netrisk-20260403-090000.sqlite",
    "netrisk-20260403-100000.sqlite",
    "netrisk-20260403-110000.sqlite",
    "netrisk-20260403-120000.sqlite",
    "other-20260403-120000.sqlite"
  ];

  try {
    files.forEach((name) => {
      fs.writeFileSync(path.join(backupDir, name), name, "utf8");
    });

    const removed = pruneBackups(path.join(backupDir, "netrisk-20260403-130000.sqlite"), 2);
    assert.equal(removed.length, 2);
    assert.deepEqual(
      fs.readdirSync(backupDir).sort(),
      [
        "netrisk-20260403-110000.sqlite",
        "netrisk-20260403-120000.sqlite",
        "other-20260403-120000.sqlite"
      ]
    );
  } finally {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

register("backup verification legge uno snapshot sqlite esistente", async () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const sourceDbFile = path.join(__dirname, `tmp-verify-${unique}.sqlite`);
  const targetDbFile = path.join(__dirname, `tmp-verify-copy-${unique}.sqlite`);
  const legacyUsersFile = path.join(__dirname, `tmp-legacy-users-${unique}.json`);
  const legacyGamesFile = path.join(__dirname, `tmp-legacy-games-${unique}.json`);
  const legacySessionsFile = path.join(__dirname, `tmp-legacy-sessions-${unique}.json`);
  const datastore = createDatastore({ dbFile: sourceDbFile, legacyUsersFile, legacyGamesFile, legacySessionsFile });

  try {
    datastore.createUser({
      id: "verify-user",
      username: "verify-user",
      role: "user",
      profile: { displayName: "Verify User" },
      credentials: { password: { hash: "x", salt: "y", iterations: 1, digest: "sha256" } },
      createdAt: new Date().toISOString()
    });
    datastore.createSession("verify-session", "verify-user", Date.now());
    datastore.createGame({
      id: "verify-game",
      name: "Verify Game",
      version: 1,
      creatorUserId: "verify-user",
      state: createInitialState(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    datastore.setActiveGameId("verify-game");
    await datastore.backupTo(targetDbFile);

    const summary = inspectBackup(targetDbFile);
    assert.equal(summary.ok, true);
    assert.equal(summary.counts.users, 1);
    assert.equal(summary.counts.games, 1);
    assert.equal(summary.counts.sessions, 1);
    assert.equal(summary.activeGameId, "verify-game");
  } finally {
    datastore.close();
    cleanupSqliteFiles(sourceDbFile);
    cleanupSqliteFiles(targetDbFile);
  }
});

register("addPlayer aggiunge giocatori e impedisce lobby oltre 4", () => {
  const state = createInitialState();
  ["A", "B", "C", "D"].forEach((name) => {
    const result = addPlayer(state, name);
    assert.equal(result.ok, true);
  });

  const overflow = addPlayer(state, "E");
  assert.equal(overflow.ok, false);
  assert.equal(overflow.error, "La lobby e piena.");
});

register("startGame distribuisce tutti i territori e assegna rinforzi iniziali", () => {
  const { state, first, second } = setupLobby();
  startGame(state, () => 0);

  assert.equal(state.phase, "active");
  assert.equal(state.turnPhase, "reinforcement");
  assert.equal(state.reinforcementPool >= 3, true);
  assert.equal(territoriesOwnedBy(state, first.id).length + territoriesOwnedBy(state, second.id).length, 9);
});

register("applyReinforcement centralizza la mutazione di rinforzo", () => {
  const { state, first } = setupLobby();
  startGame(state, () => 0);
  const owned = territoriesOwnedBy(state, first.id)[0];
  const before = state.territories[owned.id].armies;

  const result = applyReinforcement(state, first.id, owned.id);
  assert.equal(result.ok, true);
  assert.equal(state.territories[owned.id].armies, before + 1);
});

register("resolveAttack conquista un territorio quando l'attaccante vince", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 1 };
  state.territories.cinder = { ownerId: second.id, armies: 2 };

  const random = (() => {
    const values = [0.9, 0.7, 0.1];
    return () => values.shift();
  })();

  const result = resolveAttack(state, first.id, "aurora", "bastion", random);
  assert.equal(result.ok, true);
  assert.equal(state.territories.bastion.ownerId, first.id);
  assert.equal(state.pendingConquest.toId, "bastion");
  assert.equal(state.territories.bastion.armies, 0);
  assert.equal(result.combat.fromTerritoryId, "aurora");
  assert.equal(result.combat.toTerritoryId, "bastion");
  assert.equal(result.combat.diceRuleSetId, "standard");
  assert.equal(result.combat.attackDiceCount, 2);
  assert.equal(result.combat.defendDiceCount, 1);
  assert.deepEqual(result.combat.attackerRolls, [6, 5]);
  assert.deepEqual(result.combat.defenderRolls, [1]);
  assert.equal(result.combat.comparisons[0].winner, "attacker");
  assert.equal(result.combat.defenderReducedToZero, true);
  assert.equal(result.combat.conqueredTerritory, true);
  assert.deepEqual(result.pendingConquest, state.pendingConquest);
  assert.deepEqual(state.lastAction.combat, result.combat);
});

register("resolveAttack usa i dadi richiesti dall'attaccante entro il limite disponibile", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 5 };
  state.territories.bastion = { ownerId: second.id, armies: 2 };

  const random = (() => {
    const values = [0.9, 0.2, 0.1];
    return () => values.shift();
  })();

  const result = resolveAttack(state, first.id, "aurora", "bastion", random, 1);
  assert.equal(result.ok, true);
  assert.equal(result.combat.attackDiceCount, 1);
  assert.equal(result.combat.defendDiceCount, 2);
  assert.deepEqual(result.combat.attackerRolls, [6]);
  assert.deepEqual(result.combat.defenderRolls, [2, 1]);
});

register("listSupportedMaps espone riepiloghi con bonus continente per il setup", () => {
  const maps = listSupportedMaps();
  const classicMini = maps.find((map: any) => map.id === classicMiniMap.id);
  const middleEarth = maps.find((map: any) => map.id === middleEarthMap.id);
  const worldClassic = maps.find((map: any) => map.id === worldClassicMap.id);

  assert.equal(classicMini.territoryCount, classicMiniMap.territories.length);
  assert.equal(classicMini.continentCount, classicMiniMap.continents.length);
  assert.deepEqual(classicMini.continentBonuses.map((continent: any) => continent.bonus), [1, 2, 1, 1]);

  assert.equal(middleEarth.territoryCount, middleEarthMap.territories.length);
  assert.equal(middleEarth.continentCount, middleEarthMap.continents.length);
  assert.deepEqual(middleEarth.continentBonuses.map((continent: any) => continent.bonus), [2, 3, 4, 3, 2, 2, 3, 2]);

  assert.equal(worldClassic.territoryCount, worldClassicMap.territories.length);
  assert.equal(worldClassic.continentCount, worldClassicMap.continents.length);
  assert.deepEqual(worldClassic.continentBonuses.map((continent: any) => continent.bonus), [5, 2, 5, 3, 7, 2]);
});

register("resolveAttack rifiuta un numero di dadi oltre il massimo disponibile", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 2 };
  state.territories.bastion = { ownerId: second.id, armies: 2 };

  const result = resolveAttack(state, first.id, "aurora", "bastion", secureRandom, 2);
  assert.equal(result.ok, false);
  assert.equal(result.message, "Numero di dadi di attacco non valido.");
});

register("resolveAttack espone un risultato strutturato anche quando il difensore vince il confronto", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 2 };

  const random = (() => {
    const values = [0.5, 0.5, 0.5, 0.5];
    return () => values.shift();
  })();

  const result = resolveAttack(state, first.id, "aurora", "bastion", random);
  assert.equal(result.ok, true);
  assert.equal(result.combat.attackDiceCount, 2);
  assert.equal(result.combat.defendDiceCount, 2);
  assert.equal(result.combat.comparisons[0].winner, "defender");
  assert.equal(result.combat.comparisons[1].winner, "defender");
  assert.equal(result.combat.attackerArmiesBefore, 3);
  assert.equal(result.combat.defenderArmiesBefore, 2);
  assert.equal(result.combat.attackerArmiesRemaining, 1);
  assert.equal(result.combat.defenderArmiesRemaining, 2);
  assert.equal(result.combat.defenderReducedToZero, false);
  assert.equal(result.combat.conqueredTerritory, false);
  assert.equal(result.pendingConquest, null);
  assert.equal(state.pendingConquest, null);
  assert.deepEqual(state.lastAction.combat, result.combat);
});

register("moveAfterConquest trasferisce armate prima di poter chiudere il turno", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 1 };
  state.territories.cinder = { ownerId: second.id, armies: 2 };

  const random = (() => {
    const values = [0.9, 0.7, 0.1];
    return () => values.shift();
  })();

  const attack = resolveAttack(state, first.id, "aurora", "bastion", random);
  assert.equal(attack.ok, true);

  const endTurnBlocked = endTurn(state, first.id);
  assert.equal(endTurnBlocked.ok, false);

  const move = moveAfterConquest(state, first.id, 1);
  assert.equal(move.ok, true);
  assert.equal(state.pendingConquest, null);
  assert.equal(state.territories.bastion.armies, 1);
});

register("advanceTurn salta i giocatori eliminati e ricalcola i rinforzi", () => {
  const { state, first, second } = setupLobby();
  const thirdResult = addPlayer(state, "Cara");
  assert.equal(thirdResult.ok, true);
  const third = thirdResult.player;
  state.phase = "active";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;

  state.territories.aurora = { ownerId: first.id, armies: 2 };
  state.territories.bastion = { ownerId: second.id, armies: 2 };
  state.territories.cinder = { ownerId: second.id, armies: 2 };
  state.territories.delta = { ownerId: second.id, armies: 2 };
  state.territories.ember = { ownerId: second.id, armies: 2 };
  state.territories.forge = { ownerId: second.id, armies: 2 };
  state.territories.grove = { ownerId: second.id, armies: 2 };
  state.territories.harbor = { ownerId: second.id, armies: 2 };
  state.territories.ion = { ownerId: second.id, armies: 2 };

  assert.equal(territoriesOwnedBy(state, third.id).length, 0);
  advanceTurn(state);
  assert.equal(state.currentTurnIndex, 1);
  assert.equal(state.reinforcementPool, computeReinforcements(state, second.id));
  assert.equal(state.turnPhase, "reinforcement");
});

register("endTurn entra in fortifica prima di chiudere davvero il turno", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.cinder = { ownerId: first.id, armies: 1 };
  state.territories.bastion = { ownerId: second.id, armies: 2 };

  const toFortify = endTurn(state, first.id);
  assert.equal(toFortify.ok, true);
  assert.equal(state.turnPhase, "fortify");

  const fortify = applyFortify(state, first.id, "aurora", "cinder", 1);
  assert.equal(fortify.ok, true);
  assert.equal(state.territories.aurora.armies, 2);
  assert.equal(state.territories.cinder.armies, 2);

  const finishTurn = endTurn(state, first.id);
  assert.equal(finishTurn.ok, true);
  assert.equal(state.currentTurnIndex, 1);
});

register("runAiTurn completa un turno AI usando il motore esistente", () => {
  const state = createInitialState();
  const human = addPlayer(state, "Alice").player;
  const ai = addPlayer(state, "CPU", { isAi: true }).player;

  state.phase = "active";
  state.turnPhase = "reinforcement";
  state.currentTurnIndex = 1;
  state.reinforcementPool = 1;
  state.territories.aurora = { ownerId: ai.id, armies: 3 };
  state.territories.bastion = { ownerId: human.id, armies: 1 };
  state.territories.cinder = { ownerId: ai.id, armies: 1 };
  state.territories.delta = { ownerId: human.id, armies: 1 };
  state.territories.ember = { ownerId: human.id, armies: 1 };

  const random = (() => {
    const values = [0.9, 0.8, 0.7, 0.1];
    return () => values.shift() ?? 0.9;
  })();

  const result = runAiTurn(state, { random });
  assert.equal(result.ok, true);
  assert.equal(result.endedTurn, true);
  assert.equal(state.currentTurnIndex, 0);
  assert.equal(state.turnPhase, "reinforcement");
  assert.equal(state.territories.bastion.ownerId, ai.id);
  assert.equal(state.territories.bastion.armies, 2);
  assert.equal(result.conquestMoves[0].armies, 2);
});

register("runAiTurn scambia carte quando il bot e obbligato prima dei rinforzi", () => {
  const state = createInitialState();
  addPlayer(state, "Alice");
  const ai = addPlayer(state, "CPU Trader", { isAi: true }).player;

  state.phase = "active";
  state.turnPhase = "reinforcement";
  state.currentTurnIndex = 1;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: ai.id, armies: 3 };
  state.territories.bastion = { ownerId: ai.id, armies: 2 };
  state.territories.cinder = { ownerId: "enemy", armies: 1 };
  state.hands[ai.id] = [
    createCard({ id: "cpu-trade-1", type: CardType.INFANTRY }),
    createCard({ id: "cpu-trade-2", type: CardType.INFANTRY }),
    createCard({ id: "cpu-trade-3", type: CardType.INFANTRY }),
    createCard({ id: "cpu-trade-4", type: CardType.CAVALRY }),
    createCard({ id: "cpu-trade-5", type: CardType.ARTILLERY }),
    createCard({ id: "cpu-trade-6", type: CardType.WILD })
  ];

  const result = runAiTurn(state, { random: () => 0.1 });
  assert.equal(result.ok, true);
  assert.equal(result.tradedCardSets.length >= 1, true);
  assert.equal(state.hands[ai.id].length <= STANDARD_MAX_HAND_BEFORE_FORCED_TRADE, true);
  assert.equal(state.tradeCount >= 1, true);
});

register("chooseAttack usa la mappa salvata nello stato invece del default engine", () => {
  const state = createInitialState();
  const ai = addPlayer(state, "CPU Custom", { isAi: true }).player;
  const enemy = addPlayer(state, "Enemy Custom").player;

  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.mapTerritories = [
    { id: "alpha", name: "Alpha", neighbors: ["beta"], continentId: "x" },
    { id: "beta", name: "Beta", neighbors: ["alpha"], continentId: "x" }
  ];
  state.territories = {
    alpha: { ownerId: ai.id, armies: 4 },
    beta: { ownerId: enemy.id, armies: 1 }
  };

  const attack = chooseAttack(state, ai.id);
  assert.deepEqual(attack, {
    fromId: "alpha",
    toId: "beta",
    score: 29
  });
});

register("chooseFortify privilegia rinforzi dal retro verso un confine esposto", () => {
  const state = createInitialState();
  const ai = addPlayer(state, "CPU Fortify", { isAi: true }).player;
  const enemy = addPlayer(state, "Enemy").player;

  state.phase = "active";
  state.turnPhase = "fortify";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;

  state.territories.cinder = { ownerId: ai.id, armies: 4 };
  state.territories.delta = { ownerId: ai.id, armies: 1 };
  state.territories.aurora = { ownerId: ai.id, armies: 1 };
  state.territories.ember = { ownerId: ai.id, armies: 1 };
  state.territories.harbor = { ownerId: enemy.id, armies: 2 };

  const fortify = chooseFortify(state, ai.id);
  assert.deepEqual(fortify, { fromId: "cinder", toId: "delta", armies: 2, score: 15 });
});

register("standard card rules riconoscono tris, set misto e wild", () => {
  const infantrySet = validateStandardCardSet([
    createCard({ id: "c1", type: CardType.INFANTRY }),
    createCard({ id: "c2", type: CardType.INFANTRY }),
    createCard({ id: "c3", type: CardType.INFANTRY })
  ]);
  assert.equal(infantrySet.ok, true);
  assert.equal(infantrySet.pattern, "three-of-a-kind");

  const mixedSet = validateStandardCardSet([
    createCard({ id: "c4", type: CardType.INFANTRY }),
    createCard({ id: "c5", type: CardType.CAVALRY }),
    createCard({ id: "c6", type: CardType.ARTILLERY })
  ]);
  assert.equal(mixedSet.ok, true);
  assert.equal(mixedSet.pattern, "one-of-each");

  const wildSet = validateStandardCardSet([
    createCard({ id: "c7", type: CardType.CAVALRY }),
    createCard({ id: "c8", type: CardType.CAVALRY }),
    createCard({ id: "c9", type: CardType.WILD })
  ]);
  assert.equal(wildSet.ok, true);
  assert.equal(wildSet.pattern, "three-of-a-kind");
  assert.equal(wildSet.resolvedType, CardType.CAVALRY);
});

register("standard dice rules centralizzano i limiti di combattimento", () => {
  const ruleSet = getDiceRuleSet();
  assert.equal(ruleSet.id, STANDARD_DICE_RULE_SET_ID);
  assert.equal(ruleSet.attackerMaxDice, 3);
  assert.equal(ruleSet.defenderMaxDice, 2);
  assert.equal(ruleSet.attackerMustLeaveOneArmyBehind, true);
  assert.equal(ruleSet.defenderWinsTies, true);
  assert.equal(getDiceRuleSet("unsupported"), standardDiceRuleSet);
});

register("combat resolution applica i limiti dadi dal rule set centralizzato", () => {
  const customRuleSet = {
    id: "variant-test",
    attackerMaxDice: 2,
    defenderMaxDice: 1,
    attackerMustLeaveOneArmyBehind: true,
    defenderWinsTies: true
  };

  const random = (() => {
    const values = [0.95, 0.45, 0.8];
    return () => values.shift();
  })();

  const state = {
    phase: "active",
    turnPhase: "attack",
    currentTurnIndex: 0,
    players: [{ id: "p1" }, { id: "p2" }],
    territories: {
      a: { ownerId: "p1", armies: 4 },
      b: { ownerId: "p2", armies: 2 }
    }
  };
  const graph = {
    hasTerritory(id: any) { return id === "a" || id === "b"; },
    areAdjacent(fromId: any, toId: any) {
      return (fromId === "a" && toId === "b") || (fromId === "b" && toId === "a");
    }
  };

  const validationModule = require("../backend/engine/combat-resolution.cjs");
  const result = validationModule.resolveSingleAttackRoll(state, graph, "p1", "a", "b", {
    diceRuleSet: customRuleSet,
    random
  });

  assert.equal(result.ok, true);
  assert.equal(result.combat.diceRuleSetId, "variant-test");
  assert.equal(result.combat.attackDiceCount, 2);
  assert.equal(result.combat.defendDiceCount, 1);
});

register("combat dice helpers separano tiro e confronto", () => {
  const rolls = rollCombatDice(3, (() => {
    const values = [0.2, 0.95, 0.5];
    return () => values.shift();
  })());
  assert.deepEqual(rolls, [6, 4, 2]);

  const compared = compareCombatDice([2, 6, 4], [4, 1], { defenderWinsTies: true });
  assert.deepEqual(compared.attackerRolls, [6, 4, 2]);
  assert.deepEqual(compared.defenderRolls, [4, 1]);
  assert.deepEqual(compared.comparisons.map((entry: any) => entry.winner), ["attacker", "attacker"]);
});

register("standard card rules rifiutano set invalidi e centralizzano la progressione bonus", () => {
  const invalidSet = validateStandardCardSet([
    createCard({ id: "c1", type: CardType.INFANTRY }),
    createCard({ id: "c2", type: CardType.INFANTRY }),
    createCard({ id: "c3", type: CardType.CAVALRY })
  ]);
  assert.equal(invalidSet.ok, false);

  assert.equal(standardTradeBonusForIndex(0), 4);
  assert.equal(standardTradeBonusForIndex(1), 6);
  assert.equal(standardTradeBonusForIndex(5), 15);
  assert.equal(standardTradeBonusForIndex(6), 20);
  assert.equal(standardTradeBonusForIndex(7), 25);

  const ruleSet = getCardRuleSet();
  assert.equal(ruleSet.id, "standard");
  assert.equal(ruleSet.tradeBonusForIndex(2), 8);
});

register("tradeCardSet converte un set valido in rinforzi e incrementa la progressione", () => {
  const { state, first } = setupLobby();
  state.phase = "active";
  state.turnPhase = "reinforcement";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 3;
  state.hands[first.id] = [
    createCard({ id: "t1", type: CardType.INFANTRY }),
    createCard({ id: "t2", type: CardType.INFANTRY }),
    createCard({ id: "t3", type: CardType.INFANTRY })
  ];

  const result = tradeCardSet(state, first.id, ["t1", "t2", "t3"]);
  assert.equal(result.ok, true);
  assert.equal(result.bonus, 4);
  assert.equal(state.reinforcementPool, 7);
  assert.equal(state.tradeCount, 1);
  assert.deepEqual(state.hands[first.id], []);
  assert.deepEqual(state.discardPile.map((card: any) => card.id), ["t1", "t2", "t3"]);
});

register("tradeCardSet rifiuta set invalidi o trade fuori fase senza mutare lo stato", () => {
  const { state, first } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 3;
  state.hands[first.id] = [
    createCard({ id: "x1", type: CardType.INFANTRY }),
    createCard({ id: "x2", type: CardType.INFANTRY }),
    createCard({ id: "x3", type: CardType.CAVALRY })
  ];

  const wrongPhase = tradeCardSet(state, first.id, ["x1", "x2", "x3"]);
  assert.equal(wrongPhase.ok, false);
  assert.equal(state.reinforcementPool, 3);
  assert.equal(state.tradeCount, 0);
  assert.equal(state.hands[first.id].length, 3);
  assert.deepEqual(state.discardPile, []);

  state.turnPhase = "reinforcement";
  const invalidSet = tradeCardSet(state, first.id, ["x1", "x2", "x3"]);
  assert.equal(invalidSet.ok, false);
  assert.equal(state.reinforcementPool, 3);
  assert.equal(state.tradeCount, 0);
  assert.equal(state.hands[first.id].length, 3);
  assert.deepEqual(state.discardPile, []);
});

register("playerMustTradeCards segnala il limite mano standard", () => {
  const { state, first } = setupLobby();
  state.hands[first.id] = Array.from({ length: STANDARD_MAX_HAND_BEFORE_FORCED_TRADE + 1 }, (_, index) =>
    createCard({ id: "limit-" + index, type: CardType.INFANTRY })
  );

  assert.equal(playerMustTradeCards(state, first.id), true);

  state.hands[first.id] = state.hands[first.id].slice(0, STANDARD_MAX_HAND_BEFORE_FORCED_TRADE);
  assert.equal(playerMustTradeCards(state, first.id), false);
});

register("il motore forza il trade prima di uscire dal rinforzo", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "reinforcement";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 1;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 1 };
  state.hands[first.id] = [
    createCard({ id: "m1", type: CardType.INFANTRY }),
    createCard({ id: "m2", type: CardType.INFANTRY }),
    createCard({ id: "m3", type: CardType.INFANTRY }),
    createCard({ id: "m4", type: CardType.CAVALRY }),
    createCard({ id: "m5", type: CardType.CAVALRY }),
    createCard({ id: "m6", type: CardType.ARTILLERY })
  ];

  const reinforce = applyReinforcement(state, first.id, "aurora");
  assert.equal(reinforce.ok, true);
  assert.equal(state.reinforcementPool, 0);
  assert.equal(state.turnPhase, "reinforcement");

  const attackBlocked = resolveAttack(state, first.id, "aurora", "bastion");
  assert.equal(attackBlocked.ok, false);
  assert.match(attackBlocked.message, /scambiare carte/i);

  const endBlocked = endTurn(state, first.id);
  assert.equal(endBlocked.ok, false);
  assert.match(endBlocked.message, /scambiare carte/i);

  const trade = tradeCardSet(state, first.id, ["m1", "m2", "m3"]);
  assert.equal(trade.ok, true);
  assert.equal(playerMustTradeCards(state, first.id), false);
  assert.equal(state.turnPhase, "reinforcement");
});

register("awardTurnCardIfEligible assegna una carta solo dopo almeno una conquista", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 1 };
  state.territories.cinder = { ownerId: second.id, armies: 2 };

  const startingDeck = state.deck.length;
  const random = (() => {
    const values = [0.9, 0.7, 0.1];
    return () => values.shift();
  })();

  const attack = resolveAttack(state, first.id, "aurora", "bastion", random);
  assert.equal(attack.ok, true);
  assert.equal(state.conqueredTerritoryThisTurn, true);

  const moved = moveAfterConquest(state, first.id, 1);
  assert.equal(moved.ok, true);

  const toFortify = endTurn(state, first.id);
  assert.equal(toFortify.ok, true);
  assert.equal(toFortify.awardedCard, undefined);

  const finishTurn = endTurn(state, first.id);
  assert.equal(finishTurn.ok, true);
  assert.equal(Boolean(finishTurn.awardedCard), true);
  assert.equal(state.hands[first.id].length, 1);
  assert.equal(state.deck.length, startingDeck - 1);
  assert.equal(state.conqueredTerritoryThisTurn, false);
});

register("awardTurnCardIfEligible non assegna carte senza conquista o senza carte disponibili", () => {
  const { state, first } = setupLobby();
  const noneWithoutConquest = awardTurnCardIfEligible(state, first.id);
  assert.equal(noneWithoutConquest, null);

  state.conqueredTerritoryThisTurn = true;
  state.deck = [];
  state.discardPile = [];
  const noneWithoutCards = awardTurnCardIfEligible(state, first.id);
  assert.equal(noneWithoutCards, null);
  assert.equal(Array.isArray(state.hands[first.id]), false);
});

register("awardTurnCardIfEligible rimescola il discard quando il deck e vuoto", () => {
  const { state, first } = setupLobby();
  state.conqueredTerritoryThisTurn = true;
  state.deck = [];
  state.discardPile = [
    createCard({ id: "d1", type: CardType.CAVALRY }),
    createCard({ id: "d2", type: CardType.ARTILLERY })
  ];

  const awarded = awardTurnCardIfEligible(state, first.id, (() => {
    const values = [0];
    return () => values.shift() ?? 0;
  })());

  assert.equal(Boolean(awarded), true);
  assert.equal(state.hands[first.id].length, 1);
  assert.equal(state.discardPile.length, 0);
  assert.equal(state.deck.length, 1);
  assert.equal(state.hands[first.id][0].id, "d2");
});

register("awardTurnCardIfEligible non assegna piu di una carta nello stesso turno", () => {
  const { state, first } = setupLobby();
  state.conqueredTerritoryThisTurn = true;
  state.deck = [createCard({ id: "only-one", type: CardType.INFANTRY })];

  const firstAward = awardTurnCardIfEligible(state, first.id);
  const secondAward = awardTurnCardIfEligible(state, first.id);

  assert.equal(firstAward.id, "only-one");
  assert.equal(secondAward, null);
  assert.equal(state.hands[first.id].length, 1);
});

register("awardTurnCardIfEligible continua ad assegnare carte su molti turni di conquista", () => {
  const { state, first } = setupLobby();
  state.deck = [createCard({ id: "deck-1", type: CardType.INFANTRY })];
  state.discardPile = [
    createCard({ id: "discard-1", type: CardType.CAVALRY }),
    createCard({ id: "discard-2", type: CardType.ARTILLERY }),
    createCard({ id: "discard-3", type: CardType.WILD })
  ];

  const random = (() => {
    const values = [0, 0, 0, 0, 0, 0];
    return () => values.shift() ?? 0;
  })();

  for (let turn = 0; turn < 4; turn += 1) {
    state.conqueredTerritoryThisTurn = true;
    const awarded = awardTurnCardIfEligible(state, first.id, random);
    assert.equal(Boolean(awarded), true);
  }

  assert.equal(state.hands[first.id].length, 4);
  assert.deepEqual(state.hands[first.id].map((card: any) => card.id).sort(), ["deck-1", "discard-1", "discard-2", "discard-3"]);
});

register("getMapTerritories legge la mappa runtime con fallback legacy", () => {
  const defaultState = createInitialState();
  assert.deepEqual(getMapTerritories(defaultState).map((territory: any) => territory.id), classicMiniMap.territories.map((territory: any) => territory.id));

  const customState = createInitialState();
  customState.mapTerritories = [
    { id: "alpha", name: "Alpha", neighbors: [], continentId: "x" }
  ];
  assert.deepEqual(getMapTerritories(customState), customState.mapTerritories);
});

register("createInitialState inizializza deck, discard pile, hands e progressione carte standard", () => {
  const state = createInitialState();
  assert.equal(state.mapId, "classic-mini");
  assert.equal(state.mapName, "Classic Mini");
  assert.deepEqual(state.mapTerritories.map((territory: any) => territory.id), classicMiniMap.territories.map((territory: any) => territory.id));
  assert.deepEqual(state.continents.map((continent: any) => continent.id), classicMiniMap.continents.map((continent: any) => continent.id));
  assert.equal(state.cardRuleSetId, "standard");
  assert.equal(Array.isArray(state.deck), true);
  assert.equal(state.deck.length, 11);
  assert.deepEqual(state.discardPile, []);
  assert.deepEqual(state.hands, {});
  assert.equal(state.tradeCount, 0);
  assert.equal(state.deck.filter((card: any) => card.type === CardType.WILD).length, 2);
  assert.equal(state.deck.filter((card: any) => card.territoryId).length, 9);

  const rebuiltDeck = createStandardDeck(Object.keys(state.territories));
  assert.equal(rebuiltDeck.length, state.deck.length);
});

register("publicState espone i metadati carte senza rivelare deck e discard pile completi", () => {
  const { state, first, second } = setupLobby();
  state.hands[first.id] = [createCard({ id: "h1", type: CardType.INFANTRY })];
  state.hands[second.id] = [
    createCard({ id: "h2", type: CardType.CAVALRY }),
    createCard({ id: "h3", type: CardType.ARTILLERY })
  ];
  state.tradeCount = 3;
  state.discardPile = [createCard({ id: "d1", type: CardType.WILD })];

  const snapshot = publicState(state);
  assert.equal(snapshot.cardState.ruleSetId, "standard");
  assert.equal(snapshot.cardState.tradeCount, 3);
  assert.equal(snapshot.cardState.deckCount, state.deck.length);
  assert.equal(snapshot.cardState.discardCount, 1);
  assert.equal(snapshot.cardState.maxHandBeforeForcedTrade, STANDARD_MAX_HAND_BEFORE_FORCED_TRADE);
  assert.equal(snapshot.cardState.currentPlayerMustTrade, false);
  assert.equal(snapshot.players.find((player: any) => player.id === first.id).cardCount, 1);
  assert.equal(snapshot.players.find((player: any) => player.id === second.id).cardCount, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot.cardState, "deck"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot.cardState, "discardPile"), false);
});

register("publicState espone lastCombat in modo esplicito dopo un attacco", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 1 };

  const random = (() => {
    const values = [0.9, 0.1];
    return () => values.shift();
  })();

  const attack = resolveAttack(state, first.id, "aurora", "bastion", random);
  assert.equal(attack.ok, true);

  const snapshot = publicState(state);
  assert.deepEqual(snapshot.lastCombat, attack.combat);
  assert.equal(snapshot.lastCombat.toTerritoryId, "bastion");
  assert.equal(snapshot.lastCombat.diceRuleSetId, "standard");
});

register("publicState espone modelli condivisi e stato corrente", () => {
  const { state, first } = setupLobby();
  state.phase = "active";
  state.turnPhase = "attack";
  state.currentTurnIndex = 0;
  state.territories.aurora = { ownerId: first.id, armies: 4 };
  const snapshot = publicState(state);

  assert.equal(snapshot.phase, "active");
  assert.equal(snapshot.turnPhase, "attack");
  assert.equal(Array.isArray(snapshot.continents), true);
  assert.equal(snapshot.currentPlayerId, first.id);
  assert.equal(snapshot.gameConfig?.mapId, "classic-mini");
  assert.equal(snapshot.gameConfig?.diceRuleSetId, "standard");
  assert.equal(snapshot.gameConfig?.victoryRuleSetId, "conquest");
  assert.equal(snapshot.gameConfig?.themeId, "command");
  assert.equal(snapshot.gameConfig?.pieceSkinId, "classic-color");
});

register("publicState espone anche i metadati configurazione partita", () => {
  const state = createInitialState();
  state.gameConfig = {
    mapId: "classic-mini",
    diceRuleSetId: "standard",
    totalPlayers: 4,
    players: [
      { type: "human", name: "Andre" },
      { type: "human", name: "Luca" },
      { type: "ai", name: "CPU Ovest" },
      { type: "ai", name: "CPU Est" }
    ]
  };

  const snapshot = publicState(state);
  assert.equal(snapshot.gameConfig.mapId, "classic-mini");
  assert.equal(snapshot.gameConfig.mapName, "Classic Mini");
  assert.equal(snapshot.gameConfig.diceRuleSetId, "standard");
  assert.equal(snapshot.gameConfig.totalPlayers, 4);
  assert.equal(snapshot.gameConfig.players[2].type, "ai");
});

register("createInitialState supporta Middle-earth con coordinate e immagine", () => {
  const state = createInitialState(middleEarthMap);
  const snapshot = publicState(state);

  assert.equal(state.mapId, "middle-earth");
  assert.equal(state.mapName, "Middle-earth");
  assert.equal(state.mapTerritories.length, middleEarthMap.territories.length);
  assert.equal(snapshot.mapVisual.imageUrl, "/assets/maps/middle-earth.jpg");
  assert.equal(snapshot.mapVisual.aspectRatio.width, 463);
  assert.equal(snapshot.map.find((territory: any) => territory.id === "gondor").x, middleEarthMap.positions.gondor.x);
  assert.equal(snapshot.map.find((territory: any) => territory.id === "the_shire").name, "The Shire");
});

register("createInitialState supporta World Classic con i territori standard Risk", () => {
  const state = createInitialState(worldClassicMap);
  const snapshot = publicState(state);

  assert.equal(state.mapId, "world-classic");
  assert.equal(state.mapName, "World Classic");
  assert.equal(state.mapTerritories.length, 42);
  assert.equal(snapshot.mapVisual.imageUrl, "/assets/maps/world-classic.png");
  assert.equal(snapshot.mapVisual.aspectRatio.width, 800);
  assert.equal(snapshot.mapVisual.aspectRatio.height, 533);
  assert.equal(worldClassicMap.positions.alaska.x, 0.055);
  assert.equal(worldClassicMap.positions.quebec.x, 0.32);
  assert.equal(worldClassicMap.positions.ukraine.x, 0.59);
  assert.equal(worldClassicMap.positions.great_britain.y, 0.29);
  assert.equal(worldClassicMap.positions.venezuela.x, 0.22);
  assert.equal(worldClassicMap.positions.brazil.x, 0.29);
  assert.equal(worldClassicMap.positions.argentina.x, 0.22);
  assert.equal(worldClassicMap.positions.north_africa.y, 0.62);
  assert.equal(worldClassicMap.positions.northern_europe.y, 0.31);
  assert.equal(worldClassicMap.positions.india.y, 0.54);
  assert.equal(worldClassicMap.positions.new_guinea.y, 0.71);
  assert.equal(worldClassicMap.positions.japan.x, 0.93);
  assert.equal(worldClassicMap.positions.western_australia.x, 0.85);
  assert.equal(worldClassicMap.positions.western_australia.y, 0.87);
  assert.equal(snapshot.map.find((territory: any) => territory.id === "ukraine").name, "Ukraine");
  assert.equal(snapshot.map.find((territory: any) => territory.id === "eastern_australia").y, worldClassicMap.positions.eastern_australia.y);
});

register("createConfiguredInitialState usa la mappa shared selezionata", () => {
  const { state, config } = createConfiguredInitialState({
    mapId: "classic-mini",
    totalPlayers: 2,
    players: [{ type: "human" }, { type: "ai" }]
  });

  assert.equal(config.selectedMap.id, "classic-mini");
  assert.equal(state.mapId, "classic-mini");
  assert.equal(state.mapName, "Classic Mini");
  assert.deepEqual(state.mapTerritories.map((territory: any) => territory.id), classicMiniMap.territories.map((territory: any) => territory.id));
  assert.equal(state.gameConfig.mapId, "classic-mini");
});

register("createConfiguredInitialState persiste il turn timeout selezionato", () => {
  const { state, config } = createConfiguredInitialState({
    mapId: "classic-mini",
    turnTimeoutHours: 48,
    totalPlayers: 2,
    players: [{ type: "human" }, { type: "ai" }]
  });

  assert.equal(config.turnTimeoutHours, 48);
  assert.equal(state.gameConfig.turnTimeoutHours, 48);
});

register("validateNewGameConfig defaulta e valida diceRuleSetId", () => {
  const defaultConfig = validateNewGameConfig({
    mapId: "classic-mini",
    totalPlayers: 2,
    players: [{ type: "human" }, { type: "ai" }]
  });
  assert.equal(defaultConfig.diceRuleSetId, "standard");

  const defenseThreeRuleSetConfig = validateNewGameConfig({
    ruleSetId: DEFENSE_THREE_NEW_GAME_RULE_SET_ID,
    mapId: "classic-mini",
    totalPlayers: 2,
    players: [{ type: "human" }, { type: "ai" }]
  });
  assert.equal(defenseThreeRuleSetConfig.ruleSetId, DEFENSE_THREE_NEW_GAME_RULE_SET_ID);
  assert.equal(defenseThreeRuleSetConfig.diceRuleSetId, DEFENSE_THREE_DICE_RULE_SET_ID);

  const explicitConfig = validateNewGameConfig({
    mapId: "classic-mini",
    diceRuleSetId: "standard",
    totalPlayers: 2,
    players: [{ type: "human" }, { type: "human" }]
  });
  assert.equal(explicitConfig.diceRuleSetId, "standard");

  assert.throws(() => {
    validateNewGameConfig({
      mapId: "classic-mini",
      diceRuleSetId: "unsupported",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "human" }]
    });
  }, /regola dadi selezionata non e supportata/i);
});

register("validateNewGameConfig accetta solo 24, 48 o 72 ore per il timeout turno", () => {
  assert.equal(validateNewGameConfig({
    mapId: "classic-mini",
    turnTimeoutHours: 24,
    totalPlayers: 2,
    players: [{ type: "human" }, { type: "human" }]
  }).turnTimeoutHours, 24);

  assert.equal(validateNewGameConfig({
    mapId: "classic-mini",
    totalPlayers: 2,
    players: [{ type: "human" }, { type: "human" }]
  }).turnTimeoutHours, null);

  assert.throws(() => {
    validateNewGameConfig({
      mapId: "classic-mini",
      turnTimeoutHours: 12,
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "human" }]
    });
  }, /limite tempo turno selezionato non e supportato/i);
});

register("validateNewGameConfig assegna i nomi AI dal server e ignora quelli umani", () => {
  const config = validateNewGameConfig({
    mapId: "classic-mini",
    totalPlayers: 4,
    players: [
      { type: "human", name: "Nome client 1" },
      { type: "ai", name: "Nome client AI" },
      { type: "human", name: "Nome client 2" },
      { type: "ai" }
    ]
  }, {
    random: (() => {
      const values = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      return () => values.shift() ?? 0;
    })()
  });

  assert.equal(config.players[0].name, null);
  assert.equal(config.players[2].name, null);
  assert.equal(Boolean(config.players[1].name), true);
  assert.equal(Boolean(config.players[3].name), true);
  assert.notEqual(config.players[1].name, "Nome client AI");
  assert.notEqual(config.players[1].name, config.players[3].name);
});

register("validateNewGameConfig rifiuta player 1 come AI", () => {
  assert.throws(() => {
    validateNewGameConfig({
      mapId: "classic-mini",
      totalPlayers: 2,
      players: [
        { type: "ai" },
        { type: "human" }
      ]
    });
  }, /giocatore 1 deve essere sempre il creatore umano/i);
});

register("scheduled jobs route richiede un bearer token valido", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret123";

  try {
    const unauthorizedResponse = makeMockResponse();
    let executed = false;
    await handleScheduledJobsRoute(
      { headers: {} },
      unauthorizedResponse,
      async () => {
        executed = true;
        return { ok: true, jobs: [] };
      },
      sendJson,
      sendLocalizedError
    );

    assert.equal(unauthorizedResponse.statusCode, 401);
    assert.equal(executed, false);

    const authorizedResponse = makeMockResponse();
    await handleScheduledJobsRoute(
      { headers: { authorization: "Bearer test-cron-secret123" } },
      authorizedResponse,
      async () => ({ ok: true, jobs: [] }),
      sendJson,
      sendLocalizedError
    );

    assert.equal(authorizedResponse.statusCode, 200);
    assert.deepEqual(JSON.parse(authorizedResponse.body), { ok: true, jobs: [] });
  } finally {
    if (previousSecret == null) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousSecret;
    }
  }
});

register("scheduled jobs route fallisce in modo esplicito se CRON_SECRET non e configurato", async () => {
  const previousSecret = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;

  try {
    const response = makeMockResponse();
    let executed = false;
    await handleScheduledJobsRoute(
      { headers: { authorization: "Bearer anything" } },
      response,
      async () => {
        executed = true;
        return { ok: true, jobs: [] };
      },
      sendJson,
      sendLocalizedError
    );

    assert.equal(response.statusCode, 500);
    assert.equal(executed, false);
    assert.equal(JSON.parse(response.body).code, "CRON_NOT_CONFIGURED");
  } finally {
    if (previousSecret == null) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousSecret;
    }
  }
});

register("AI turn recovery service forza un turno bloccato e resta idempotente", async () => {
  const state = createInitialState();
  state.players = [
    { id: "p1", name: "CPU Alpha", color: "#111111", connected: true, isAi: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  startGame(state, () => 0, new Date("2026-04-10T08:00:00.000Z"));

  const first = await recoverAiTurnState(state, {
    runAiTurnsIfNeeded: () => []
  });
  const second = await recoverAiTurnState(state, {
    runAiTurnsIfNeeded: () => []
  });

  assert.equal(first.forcedTurn, true);
  assert.equal(first.shouldPersist, true);
  assert.equal(first.interceptedError, false);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.lastAction.summaryKey, "game.log.aiTurnRecovered");
  assert.equal(second.eligible, false);
  assert.equal(second.shouldPersist, false);
});

register("AI turn recovery batch job intercetta errori e salta i version conflict", async () => {
  const state = createInitialState();
  state.players = [
    { id: "p1", name: "CPU Alpha", color: "#111111", connected: true, isAi: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  startGame(state, () => 0, new Date("2026-04-10T08:00:00.000Z"));

  const result = await recoverStuckAiTurns({
    listGames: () => [
      { id: "ai-stuck", name: "AI Stuck", version: 4, state }
    ],
    saveGame: () => {
      const error = new Error("stale save");
      (error as Error & { code?: string }).code = "VERSION_CONFLICT";
      throw error;
    },
    runAiTurnsIfNeeded: () => {
      throw new Error("boom");
    }
  });

  assert.equal(result.scannedGames, 1);
  assert.equal(result.eligibleGames, 1);
  assert.equal(result.recoveryAttempts, 1);
  assert.equal(result.interceptedErrors, 1);
  assert.equal(result.recoveredGames, 0);
  assert.equal(result.forcedTurns, 0);
  assert.equal(result.skippedConflicts, 1);
});

register("turn timeout service ignora partite legacy senza timeout e turni non scaduti", async () => {
  const legacyState = createInitialState();
  legacyState.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  startGame(legacyState, () => 0);
  legacyState.gameConfig = { mapId: "classic-mini" };
  legacyState.turnStartedAt = new Date("2026-04-10T08:00:00.000Z").toISOString();

  const freshState = createInitialState();
  freshState.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  startGame(freshState, () => 0);
  freshState.gameConfig = { mapId: "classic-mini", turnTimeoutHours: 24 };
  freshState.turnStartedAt = new Date("2026-04-13T12:30:00.000Z").toISOString();

  let saveCalls = 0;
  const result = await enforceTurnTimeouts({
    listGames: () => [
      { id: "legacy", name: "Legacy", version: 1, state: legacyState },
      { id: "fresh", name: "Fresh", version: 1, state: freshState }
    ],
    saveGame: () => {
      saveCalls += 1;
      return { version: 2 };
    },
    forceEndTurn,
    now: new Date("2026-04-14T08:00:00.000Z")
  });

  assert.equal(result.scannedGames, 2);
  assert.equal(result.expiredGames, 0);
  assert.equal(result.forcedTurns, 0);
  assert.equal(saveCalls, 0);
});

register("turn timeout service forza il turno scaduto una sola volta e passa al giocatore successivo", async () => {
  const state = createInitialState();
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  state.gameConfig = { mapId: "classic-mini", turnTimeoutHours: 24 };
  startGame(state, () => 0);
  state.turnStartedAt = new Date("2026-04-12T07:00:00.000Z").toISOString();

  let version = 1;
  let saveCalls = 0;
  const runJob = () => enforceTurnTimeouts({
    listGames: () => [
      { id: "timeout-game", name: "Timeout", version, state }
    ],
    saveGame: (_gameId: string, _state: Record<string, unknown>, expectedVersion?: number | null) => {
      assert.equal(expectedVersion, version);
      saveCalls += 1;
      version += 1;
      return { version };
    },
    forceEndTurn,
    recoverAiTurnState: async () => ({
      eligible: false,
      attempted: false,
      advanced: false,
      forcedTurn: false,
      interceptedError: false,
      shouldPersist: false,
      reports: []
    }),
    now: new Date("2026-04-14T08:00:00.000Z")
  });

  const firstRun = await runJob();
  assert.equal(firstRun.expiredGames, 1);
  assert.equal(firstRun.forcedTurns, 1);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.turnPhase, "reinforcement");
  assert.equal(state.lastAction.summaryKey, "game.log.turnTimedOut");
  assert.equal(state.turnStartedAt, "2026-04-14T08:00:00.000Z");

  const secondRun = await runJob();
  assert.equal(secondRun.expiredGames, 0);
  assert.equal(secondRun.forcedTurns, 0);
  assert.equal(saveCalls, 1);
});

register("scheduler entrypoint espone anche il job di recovery AI", async () => {
  const payload = await runScheduledJobs({
    listGames: () => [],
    saveGame: () => ({ version: 1 }),
    forceEndTurn,
    recoverAiTurnState: async () => ({
      eligible: false,
      attempted: false,
      advanced: false,
      forcedTurn: false,
      interceptedError: false,
      shouldPersist: false,
      reports: []
    })
  });

  assert.equal(payload.ok, true);
  assert.deepEqual(payload.jobs.map((job: any) => job.name), [
    "turn-timeout-enforcement",
    "ai-turn-recovery"
  ]);
});

register("API games richiede autenticazione per creare una partita", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Anonima" })
    });
    assert.equal(response.status, 401);
    const payload: any = await readJson(response);
    assert.equal(payload.code, "AUTH_REQUIRED");
  });
});

register("game session store salva il creator user id", () => {
  const tempGames = path.join(__dirname, `tmp-games-${Date.now()}-creator.json`);
  const tempDbFile = path.join(__dirname, `tmp-games-${Date.now()}-creator.sqlite`);
  const store = createGameSessionStore({ dataFile: tempGames, dbFile: tempDbFile });

  try {
    const created = store.createGame(createInitialState(), { name: "Con owner", creatorUserId: "user-123" });
    assert.equal(created.game.name, "Con owner");
    const saved = store.datastore.findGameById(created.game.id);
    assert.equal(saved.creatorUserId, "user-123");
  } finally {
    store.datastore.close();
    if (fs.existsSync(tempGames)) fs.unlinkSync(tempGames);
    cleanupSqliteFiles(tempDbFile);
  }
});

register("game session store importa partite legacy da JSON al primo avvio", () => {
  const unique = `${Date.now()}-${uniqueSuffix()}`;
  const tempGames = path.join(__dirname, `tmp-games-${unique}.json`);
  const tempDbFile = path.join(__dirname, `tmp-games-${unique}.sqlite`);

  const legacyState = createInitialState();
  legacyState.log.push("Migrata da json");

  fs.writeFileSync(tempGames, JSON.stringify({
    games: [{
      id: "legacy-game",
      name: "Legacy match",
      version: 3,
      creatorUserId: "legacy-user",
      state: legacyState,
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:05:00.000Z"
    }],
    activeGameId: "legacy-game"
  }, null, 2) + "\n", "utf8");

  const store = createGameSessionStore({ dataFile: tempGames, dbFile: tempDbFile });

  try {
    const reopened = store.openGame("legacy-game");
    assert.equal(reopened.game.name, "Legacy match");
    assert.equal(reopened.game.version, 3);
    assert.equal(reopened.state.log.includes("Migrata da json"), true);
    assert.equal(store.datastore.getActiveGameId(), "legacy-game");
  } finally {
    store.datastore.close();
    if (fs.existsSync(tempGames)) fs.unlinkSync(tempGames);
    cleanupSqliteFiles(tempDbFile);
  }
});

register("API state consente lettura spettatore sulla lobby protetta senza auto-join", async () => {
  await withServer(async (baseUrl) => {
    const owner = await createAuthenticatedSession(baseUrl, uniqueName("state_owner"));
    const outsider = await createAuthenticatedSession(baseUrl, uniqueName("state_out"));
    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(owner.sessionToken),
      body: JSON.stringify({ name: "Stato protetto" })
    });
    assert.equal(created.status, 201);

    const outsiderState = await fetch(baseUrl + "/api/state", {
      headers: authHeaders(outsider.sessionToken)
    });
    assert.equal(outsiderState.status, 200);
    const outsiderPayload: any = await readJson(outsiderState);
    assert.equal(outsiderPayload.gameName, "Stato protetto");
    assert.equal(outsiderPayload.playerId, null);
    assert.equal(Array.isArray(outsiderPayload.playerHand), false);

    const ownerState = await fetch(baseUrl + "/api/state", {
      headers: authHeaders(owner.sessionToken)
    });
    assert.equal(ownerState.status, 200);
  });
});

register("API games open richiede autenticazione", async () => {
  await withServer(async (baseUrl) => {
    const owner = await createAuthenticatedSession(baseUrl, uniqueName("open_owner"));
    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(owner.sessionToken),
      body: JSON.stringify({ name: "Apri protetta" })
    });
    assert.equal(created.status, 201);
    const createdPayload: any = await readJson(created);

    const opened = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: createdPayload.game.id })
    });
    assert.equal(opened.status, 401);
    const payload: any = await readJson(opened);
    assert.equal(payload.code, "AUTH_REQUIRED");
  });
});

register("API state restituisce GAME_NOT_FOUND per un gameId inesistente senza crashare il server", async () => {
  await withServer(async (baseUrl) => {
    const owner = await createAuthenticatedSession(baseUrl, uniqueName("missing_game_owner"));
    const response = await fetch(baseUrl + "/api/state?gameId=missing-game-id", {
      headers: authHeaders(owner.sessionToken)
    });
    assert.equal(response.status, 404);
    const payload: any = await readJson(response);
    assert.equal(payload.code, "GAME_NOT_FOUND");

    const health = await fetch(baseUrl + "/api/health");
    assert.equal(health.status, 200);
  });
});

register("API games open consente al creatore di riaprire la propria partita", async () => {
  await withServer(async (baseUrl) => {
    const owner = await createAuthenticatedSession(baseUrl, uniqueName("open_member"));
    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(owner.sessionToken),
      body: JSON.stringify({ name: "Apri membro" })
    });
    assert.equal(created.status, 201);
    const createdPayload: any = await readJson(created);

    const opened = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: authHeaders(owner.sessionToken),
      body: JSON.stringify({ gameId: createdPayload.game.id })
    });
    assert.equal(opened.status, 200);
  });
});

register("API state e mutazioni restano isolate tra partite diverse tramite gameId", async () => {
  await withServer(async (baseUrl) => {
    const ownerA = await createAuthenticatedSession(baseUrl, uniqueName("isolate_a"));
    const ownerB = await createAuthenticatedSession(baseUrl, uniqueName("isolate_b"));

    const createdA = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerA.sessionToken),
      body: JSON.stringify({ name: "Isolation A" })
    });
    assert.equal(createdA.status, 201);
    const payloadA: any = await readJson(createdA);

    const createdB = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerB.sessionToken),
      body: JSON.stringify({ name: "Isolation B" })
    });
    assert.equal(createdB.status, 201);
    const payloadB: any = await readJson(createdB);

    const aiJoinA = await fetch(baseUrl + "/api/ai/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CPU A", gameId: payloadA.game.id })
    });
    assert.equal(aiJoinA.status, 201);

    const openB = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: authHeaders(ownerB.sessionToken),
      body: JSON.stringify({ gameId: payloadB.game.id })
    });
    assert.equal(openB.status, 200);

    const stateA = await fetch(baseUrl + `/api/state?gameId=${encodeURIComponent(payloadA.game.id)}`, {
      headers: authHeaders(ownerA.sessionToken)
    });
    assert.equal(stateA.status, 200);
    const stateAPayload: any = await readJson(stateA);
    assert.equal(stateAPayload.gameId, payloadA.game.id);
    assert.equal(stateAPayload.players.length, 2);

    const stateB = await fetch(baseUrl + `/api/state?gameId=${encodeURIComponent(payloadB.game.id)}`, {
      headers: authHeaders(ownerB.sessionToken)
    });
    assert.equal(stateB.status, 200);
    const stateBPayload: any = await readJson(stateB);
    assert.equal(stateBPayload.gameId, payloadB.game.id);
    assert.equal(stateBPayload.players.length, 1);
  });
});

register("API start consente solo al creatore di avviare la partita", async () => {
  await withServer(async (baseUrl) => {
    const owner = await createAuthenticatedSession(baseUrl, uniqueName("host"));
    const guest = await createAuthenticatedSession(baseUrl, uniqueName("guest"));

    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(owner.sessionToken),
      body: JSON.stringify({ name: "Host only" })
    });
    assert.equal(created.status, 201);

    const joinOwner = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(owner.sessionToken),
      body: JSON.stringify({ sessionToken: owner.sessionToken })
    });
    const joinOwnerPayload: any = await readJson(joinOwner);

    const joinGuest = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(guest.sessionToken),
      body: JSON.stringify({ sessionToken: guest.sessionToken })
    });
    const joinGuestPayload: any = await readJson(joinGuest);

    const forbiddenStart = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(guest.sessionToken),
      body: JSON.stringify({ sessionToken: guest.sessionToken, playerId: joinGuestPayload.playerId })
    });
    assert.equal(forbiddenStart.status, 403);
    const forbiddenPayload: any = await readJson(forbiddenStart);
    assert.equal(forbiddenPayload.code, "HOST_ONLY");

    const ownerStart = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(owner.sessionToken),
      body: JSON.stringify({ sessionToken: owner.sessionToken, playerId: joinOwnerPayload.playerId })
    });
    assert.equal(ownerStart.status, 200);
  });
});
register("API game options espone setup base per nuova partita", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/game-options");
    assert.equal(response.status, 200);
    const payload: any = await readJson(response);
    assert.deepEqual(payload.maps, listSupportedMaps());
    assert.equal(Array.isArray(payload.ruleSets), true);
    assert.equal(payload.ruleSets.some((ruleSet: any) => ruleSet.id === DEFENSE_THREE_NEW_GAME_RULE_SET_ID), true);
    assert.equal(Array.isArray(payload.diceRuleSets), true);
    assert.equal(payload.diceRuleSets[0].id, "standard");
    assert.equal(payload.diceRuleSets.some((ruleSet: any) => ruleSet.id === DEFENSE_THREE_DICE_RULE_SET_ID), true);
    assert.equal(payload.victoryRuleSets.some((ruleSet: any) => ruleSet.id === "conquest"), true);
    assert.equal(payload.victoryRuleSets.some((ruleSet: any) => ruleSet.id === "majority-control"), true);
    assert.equal(payload.themes.some((theme: any) => theme.id === "command"), true);
    assert.equal(payload.themes.some((theme: any) => theme.id === "midnight"), true);
    assert.equal(payload.pieceSkins.some((pieceSkin: any) => pieceSkin.id === "classic-color"), true);
    assert.equal(payload.pieceSkins.some((pieceSkin: any) => pieceSkin.id === "command-ring"), true);
    assert.deepEqual(payload.turnTimeoutHoursOptions, listTurnTimeoutHoursOptions());
    assert.equal(payload.playerRange.min, 2);
    assert.equal(payload.playerRange.max, 4);
  });
});

register("API game options alias espone le capability modulari dal backend", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/game/options");
    assert.equal(response.status, 200);
    const payload: any = await readJson(response);
    assert.equal(Array.isArray(payload.ruleSets), true);
    assert.equal(Array.isArray(payload.maps), true);
    assert.equal(Array.isArray(payload.diceRuleSets), true);
    assert.equal(Array.isArray(payload.victoryRuleSets), true);
    assert.equal(Array.isArray(payload.themes), true);
    assert.equal(Array.isArray(payload.pieceSkins), true);
    assert.equal(payload.victoryRuleSets.some((ruleSet: any) => ruleSet.id === "conquest"), true);
    assert.equal(payload.victoryRuleSets.some((ruleSet: any) => ruleSet.id === "majority-control"), true);
    assert.equal(payload.themes.some((theme: any) => theme.id === "ember"), true);
    assert.equal(payload.pieceSkins.some((pieceSkin: any) => pieceSkin.id === "command-ring"), true);
  });
});

register("API games crea una sessione da configurazione strutturata", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAuthenticatedSession(baseUrl,       uniqueName("creator")
    );
    const response = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify({
        name: "Scenario AI",
        mapId: "classic-mini",
        diceRuleSetId: "standard",
        victoryRuleSetId: "majority-control",
        themeId: "ember",
        pieceSkinId: "command-ring",
        turnTimeoutHours: 72,
        totalPlayers: 3,
        players: [
          { type: "human" },
          { type: "ai" },
          { type: "ai" }
        ]
      })
    });
    assert.equal(response.status, 201);
    const payload: any = await readJson(response);
    assert.equal(payload.game.name, "Scenario AI");
    assert.equal(payload.config.diceRuleSetId, "standard");
    assert.equal(payload.config.victoryRuleSetId, "majority-control");
    assert.equal(payload.config.themeId, "ember");
    assert.equal(payload.config.pieceSkinId, "command-ring");
    assert.equal(payload.config.turnTimeoutHours, 72);
    assert.equal(payload.state.gameConfig.diceRuleSetId, "standard");
    assert.equal(payload.state.gameConfig.victoryRuleSetId, "majority-control");
    assert.equal(payload.state.gameConfig.themeId, "ember");
    assert.equal(payload.state.gameConfig.pieceSkinId, "command-ring");
    assert.equal(payload.state.gameConfig.pieceSkin.id, "command-ring");
    assert.equal(payload.state.gameConfig.pieceSkin.renderStyleId, "ring-core");
    assert.equal(payload.state.gameConfig.turnTimeoutHours, 72);
    assert.equal(payload.config.totalPlayers, 3);
    assert.equal(payload.config.players[0].name, null);
    assert.equal(payload.config.players[1].type, "ai");
    assert.equal(Boolean(payload.config.players[1].name), true);
    assert.equal(payload.state.players.length, 3);
    assert.equal(payload.playerId != null, true);
    assert.equal(payload.state.players.some((player: any) => player.id === payload.playerId && player.name === session.user.username && player.isAi === false), true);
    assert.equal(payload.state.players.filter((player: any) => player.isAi).length, 2);
  });
});

register("API cron scheduled jobs forza il turno scaduto e sincronizza lo stato attivo", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "integration-cron-secret123";

  try {
    await withServer(async (baseUrl, context) => {
      const owner = await createAuthenticatedSession(baseUrl, uniqueName("cron_owner"));
      const opponent = await createAuthenticatedSession(baseUrl, uniqueName("cron_opp"));
      const created = await fetch(baseUrl + "/api/games", {
        method: "POST",
        headers: authHeaders(owner.sessionToken),
        body: JSON.stringify({
          name: "Cron Timeout Match",
          turnTimeoutHours: 24,
          totalPlayers: 2,
          players: [
            { type: "human" },
            { type: "human" }
          ]
        })
      });
      assert.equal(created.status, 201);
      const createdPayload: any = await readJson(created);

      const ownerJoin = await fetch(baseUrl + "/api/join", {
        method: "POST",
        headers: authHeaders(owner.sessionToken),
        body: JSON.stringify({ sessionToken: owner.sessionToken, gameId: createdPayload.game.id })
      });
      assert.equal(ownerJoin.status, 200);
      const ownerJoinPayload: any = await readJson(ownerJoin);

      const opponentJoin = await fetch(baseUrl + "/api/join", {
        method: "POST",
        headers: authHeaders(opponent.sessionToken),
        body: JSON.stringify({ sessionToken: opponent.sessionToken, gameId: createdPayload.game.id })
      });
      assert.equal(opponentJoin.status, 201);
      const opponentJoinPayload: any = await readJson(opponentJoin);

      const startResponse = await fetch(baseUrl + "/api/start", {
        method: "POST",
        headers: authHeaders(owner.sessionToken),
        body: JSON.stringify({
          sessionToken: owner.sessionToken,
          gameId: createdPayload.game.id,
          playerId: ownerJoinPayload.playerId
        })
      });
      assert.equal(startResponse.status, 200);

      const storedGame = await context.app.datastore.findGameById(createdPayload.game.id);
      storedGame.state.gameConfig = {
        ...(storedGame.state.gameConfig || {}),
        turnTimeoutHours: 24
      };
      storedGame.state.turnStartedAt = "2000-01-01T00:00:00.000Z";
      storedGame.updatedAt = new Date().toISOString();
      await context.app.datastore.updateGame(storedGame);

      const cronResponse = await fetch(baseUrl + "/api/cron/scheduled-jobs", {
        headers: {
          authorization: "Bearer integration-cron-secret123"
        }
      });
      assert.equal(cronResponse.status, 200);
      const cronPayload: any = await readJson(cronResponse);
      assert.equal(cronPayload.jobs[0].result.forcedTurns, 1);
      assert.deepEqual(cronPayload.jobs.map((job: any) => job.name), [
        "turn-timeout-enforcement",
        "ai-turn-recovery"
      ]);

      const stateResponse = await fetch(baseUrl + `/api/state?gameId=${encodeURIComponent(createdPayload.game.id)}`, {
        headers: authHeaders(owner.sessionToken)
      });
      assert.equal(stateResponse.status, 200);
      const statePayload: any = await readJson(stateResponse);
      assert.equal(statePayload.currentPlayerId, opponentJoinPayload.playerId);
      assert.equal(statePayload.turnPhase, "reinforcement");
    });
  } finally {
    if (previousSecret == null) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousSecret;
    }
  }
});

register("API games summary espone metadati configurazione", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAuthenticatedSession(baseUrl,       uniqueName("summary")
    );
    const createResponse = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify({
        name: "Scenario Meta",
        mapId: "classic-mini",
        diceRuleSetId: "standard",
        totalPlayers: 4,
        players: [
          { type: "human" },
          { type: "human" },
          { type: "ai" },
          { type: "ai" }
        ]
      })
    });
    assert.equal(createResponse.status, 201);

    const listResponse = await fetch(baseUrl + "/api/games");
    assert.equal(listResponse.status, 200);
    const listPayload: any = await readJson(listResponse);
    const game = listPayload.games.find((entry: any) => entry.name === "Scenario Meta");

    assert.equal(game.mapId, "classic-mini");
    assert.equal(game.mapName, "Classic Mini");
    assert.equal(game.diceRuleSetId, "standard");
    assert.equal(game.totalPlayers, 4);
    assert.equal(game.aiCount, 2);
  });
});

register("API games rifiuta configurazioni incomplete", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAuthenticatedSession(baseUrl,       uniqueName("invalid")
    );
    const response = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify({
        name: "Scenario non valido",
        mapId: "classic-mini",
        totalPlayers: 3,
        players: [{ type: "human", name: "Solo uno" }]
      })
    });
    assert.equal(response.status, 400);
    const payload: any = await readJson(response);
    assert.equal(payload.error, "Configura tutti gli slot giocatore prima di creare la partita.");
  });
});

register("API games create + list + open persiste e riapre una sessione", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAuthenticatedSession(baseUrl, uniqueName("list"));
    const initialList = await fetch(baseUrl + "/api/games");
    assert.equal(initialList.status, 200);
    const initialPayload: any = await readJson(initialList);
    assert.equal(Array.isArray(initialPayload.games), true);

    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify({ name: "Campagna test" })
    });
    assert.equal(created.status, 201);
    const createdPayload: any = await readJson(created);
    assert.equal(createdPayload.game.name, "Campagna test");
    assert.equal(Boolean(createdPayload.game.id), true);
    assert.equal(createdPayload.state.phase, "lobby");
    assert.equal(createdPayload.activeGameId, createdPayload.game.id);

    const listed = await fetch(baseUrl + "/api/games");
    const listedPayload: any = await readJson(listed);
    assert.equal(listedPayload.games.some((game: any) => game.id === createdPayload.game.id), true);

    const opened = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify({ gameId: createdPayload.game.id })
    });
    assert.equal(opened.status, 200);
    const openedPayload: any = await readJson(opened);
    assert.equal(openedPayload.activeGameId, createdPayload.game.id);
    assert.equal(openedPayload.state.gameId, createdPayload.game.id);
  });
});

register("API game session persists mutations across reopen", async () => {
  await withServer(async (baseUrl) => {
    const firstUser = `persist_a_${Date.now()}`;
    const ownerSession = await createAuthenticatedSession(baseUrl, firstUser);
    const createdResponse = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "Persistenza campagna" })
    });
    assert.equal(createdResponse.status, 201);
    const createdPayload: any = await readJson(createdResponse);
    const gameId = createdPayload.game.id;

    const secondUser = `persist_b_${Date.now()}`;

    const registerSecond = await fetch(baseUrl + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: secondUser, password: TEST_PASSWORD })
    });
    assert.equal(registerSecond.status, 201);

    const firstAuth = ownerSession;

    const joinFirst = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(firstAuth.sessionToken),
      body: JSON.stringify({ sessionToken: firstAuth.sessionToken })
    });
    assert.equal(joinFirst.status, 200);
    const firstJoinPayload: any = await readJson(joinFirst);

    const loginSecond = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: secondUser, password: TEST_PASSWORD })
    });
    const secondAuthPayload: any = await readJson(loginSecond);
    const secondAuth = {
      ...secondAuthPayload,
      sessionToken: sessionTokenFromSetCookie(loginSecond.headers.get("set-cookie"))
    };

    const joinSecond = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(secondAuth.sessionToken),
      body: JSON.stringify({ sessionToken: secondAuth.sessionToken })
    });
    assert.equal(joinSecond.status, 201);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(firstAuth.sessionToken),
      body: JSON.stringify({ sessionToken: firstAuth.sessionToken, playerId: firstJoinPayload.playerId })
    });
    assert.equal(startResponse.status, 200);
    const startedPayload: any = await readJson(startResponse);

    const ownedTerritoryId = startedPayload.state.map.find((territory: any) => territory.ownerId === firstJoinPayload.playerId).id;

    const reinforceResponse = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(firstAuth.sessionToken),
      body: JSON.stringify({
        sessionToken: firstAuth.sessionToken,
        playerId: firstJoinPayload.playerId,
        type: "reinforce",
        territoryId: ownedTerritoryId
      })
    });
    assert.equal(reinforceResponse.status, 200);

    const reopenedResponse = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: authHeaders(firstAuth.sessionToken),
      body: JSON.stringify({ gameId })
    });
    assert.equal(reopenedResponse.status, 200);
    const reopenedPayload: any = await readJson(reopenedResponse);

    const reopenedTerritory = reopenedPayload.state.map.find((territory: any) => territory.id === ownedTerritoryId);
    assert.equal(reopenedPayload.state.gameId, gameId);
    assert.equal(reopenedPayload.state.phase, "active");
    assert.equal(reopenedTerritory.ownerId, firstJoinPayload.playerId);
    assert.equal(reopenedTerritory.armies >= 2, true);
  });
});

register("API game session restores active game across app recreation", async () => {
  const tempUsers = path.join(__dirname, `tmp-users-${Date.now()}-restore.json`);
  const tempGames = path.join(__dirname, `tmp-games-${Date.now()}-restore.json`);
  const tempSessions = path.join(__dirname, `tmp-sessions-${Date.now()}-restore.json`);
  const tempDbFile = path.join(__dirname, `tmp-games-${Date.now()}-restore.sqlite`);
  let app = createApp({ dataFile: tempUsers, gamesFile: tempGames, sessionsFile: tempSessions, dbFile: tempDbFile });

  try {
    const firstSession = await createAuthenticatedAppSession(app, uniqueName("restore"));
    const created = await fetchGame(app, "/api/games", { method: "POST", headers: authHeaders(firstSession.sessionToken), body: { name: "Sessione persistita" } });
    const createdGameId = created.game.id;

    const second = await fetchGame(app, "/api/games", { method: "POST", headers: authHeaders(firstSession.sessionToken), body: { name: "Altra sessione" } });
    const secondGameId = second.game.id;

    await fetchGame(app, "/api/games/open", { method: "POST", headers: authHeaders(firstSession.sessionToken), body: { gameId: createdGameId } });

    app.datastore.close();
    await new Promise<void>((resolve) => app.server.close(resolve));
    app = createApp({ dataFile: tempUsers, gamesFile: tempGames, sessionsFile: tempSessions, dbFile: tempDbFile });

    const relogin = await app.auth.loginWithPassword(firstSession.user.username, TEST_PASSWORD);
    assert.equal(relogin.ok, true);

    const stateResponse = await callApp(app, "GET", "/api/state", undefined, authHeaders(relogin.sessionToken));
    assert.equal(stateResponse.statusCode, 200);
    assert.equal(stateResponse.payload.gameId, createdGameId);

    const listResponse = await callApp(app, "GET", "/api/games");
    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.payload.activeGameId, createdGameId);
    assert.equal(listResponse.payload.games.some((game: any) => game.id === secondGameId), true);
  } finally {
    app.datastore.close();
    if (app.server.listening) {
      await new Promise<void>((resolve) => app.server.close(resolve));
    }
    if (fs.existsSync(tempUsers)) fs.unlinkSync(tempUsers);
    if (fs.existsSync(tempGames)) fs.unlinkSync(tempGames);
    if (fs.existsSync(tempSessions)) fs.unlinkSync(tempSessions);
    cleanupSqliteFiles(tempDbFile);
  }
});

register("game session store versiona i salvataggi e rifiuta versioni stale", () => {
  const tempGames = path.join(__dirname, `tmp-games-${Date.now()}-version.json`);
  const tempDbFile = path.join(__dirname, `tmp-games-${Date.now()}-version.sqlite`);
  const store = createGameSessionStore({ dataFile: tempGames, dbFile: tempDbFile });

  try {
    const created = store.createGame(createInitialState(), { name: "Versionata" });
    assert.equal(created.game.version, 1);

    const nextState = createInitialState();
    nextState.log.push("Mutazione 1");
    const saved = store.saveGame(created.game.id, nextState, 1);
    assert.equal(saved.version, 2);

    assert.throws(() => {
      store.saveGame(created.game.id, nextState, 1);
    }, (error: any) => error && error.code === "VERSION_CONFLICT" && error.currentVersion === 2);
  } finally {
    store.datastore.close();
    if (fs.existsSync(tempGames)) fs.unlinkSync(tempGames);
    cleanupSqliteFiles(tempDbFile);
  }
});

register("game session store mantiene versioni indipendenti tra partite", () => {
  const tempGames = path.join(__dirname, `tmp-games-${Date.now()}-independent.json`);
  const tempDbFile = path.join(__dirname, `tmp-games-${Date.now()}-independent.sqlite`);
  const store = createGameSessionStore({ dataFile: tempGames, dbFile: tempDbFile });

  try {
    const first = store.createGame(createInitialState(), { name: "Prima" });
    const second = store.createGame(createInitialState(), { name: "Seconda" });
    const mutated = createInitialState();
    mutated.log.push("Solo prima");

    const savedFirst = store.saveGame(first.game.id, mutated, 1);
    const reopenedSecond = store.openGame(second.game.id);

    assert.equal(savedFirst.version, 2);
    assert.equal(reopenedSecond.game.version, 1);
  } finally {
    store.datastore.close();
    if (fs.existsSync(tempGames)) fs.unlinkSync(tempGames);
    cleanupSqliteFiles(tempDbFile);
  }
});

register("API action incrementa la version e rifiuta expectedVersion stale", async () => {
  await withServer(async (baseUrl) => {
    const ownerSession = await createAuthenticatedSession(baseUrl, uniqueName("concurrency_owner"));
    const createdResponse = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "Concorrenza" })
    });
    assert.equal(createdResponse.status, 201);
    const createdPayload: any = await readJson(createdResponse);
    assert.equal(createdPayload.state.version, 1);

    const uniqueVersionSuffix = uniqueSuffix();
    const firstUsername = `va_${uniqueVersionSuffix}`;
    const secondUsername = `vb_${uniqueVersionSuffix}`;

    const registerFirst = await fetch(baseUrl + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: firstUsername, password: TEST_PASSWORD })
    });
    assert.equal(registerFirst.status, 201);

    const registerSecond = await fetch(baseUrl + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: secondUsername, password: TEST_PASSWORD })
    });
    assert.equal(registerSecond.status, 201);

    const firstLoginPayload = ownerSession;

    const joinFirst = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(firstLoginPayload.sessionToken),
      body: JSON.stringify({ sessionToken: firstLoginPayload.sessionToken })
    });
    assert.equal(joinFirst.status, 200);
    const firstJoinPayload: any = await readJson(joinFirst);

    const loginSecond = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: secondUsername, password: TEST_PASSWORD })
    });
    const secondLoginBody: any = await readJson(loginSecond);
    const secondLoginPayload = {
      ...secondLoginBody,
      sessionToken: sessionTokenFromSetCookie(loginSecond.headers.get("set-cookie"))
    };

    const joinSecond = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(secondLoginPayload.sessionToken),
      body: JSON.stringify({ sessionToken: secondLoginPayload.sessionToken })
    });
    assert.equal(joinSecond.status, 201);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(firstLoginPayload.sessionToken),
      body: JSON.stringify({ sessionToken: firstLoginPayload.sessionToken, playerId: firstJoinPayload.playerId })
    });
    assert.equal(startResponse.status, 200);

    const stateResponse = await fetch(baseUrl + "/api/state", { headers: authHeaders(firstLoginPayload.sessionToken) });
    const statePayload: any = await readJson(stateResponse);
    const ownedTerritory = statePayload.map.find((territory: any) => territory.ownerId === firstJoinPayload.playerId);

    const actionResponse = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(firstLoginPayload.sessionToken),
      body: JSON.stringify({
        sessionToken: firstLoginPayload.sessionToken,
        playerId: firstJoinPayload.playerId,
        type: "reinforce",
        territoryId: ownedTerritory.id,
        expectedVersion: statePayload.version
      })
    });
    assert.equal(actionResponse.status, 200);
    const actionPayload: any = await readJson(actionResponse);
    assert.equal(actionPayload.state.version, statePayload.version + 1);

    const staleResponse = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(firstLoginPayload.sessionToken),
      body: JSON.stringify({
        sessionToken: firstLoginPayload.sessionToken,
        playerId: firstJoinPayload.playerId,
        type: "reinforce",
        territoryId: ownedTerritory.id,
        expectedVersion: statePayload.version
      })
    });
    assert.equal(staleResponse.status, 409);
    const stalePayload: any = await readJson(staleResponse);
    assert.equal(stalePayload.code, "VERSION_CONFLICT");
    assert.equal(stalePayload.currentVersion, actionPayload.state.version);
    assert.equal(stalePayload.state.version, actionPayload.state.version);
  });
});

register("API games open ricollega il player umano corretto dopo logout e nuovo login", async () => {
  await withServer(async (baseUrl) => {
    const username = uniqueName("rebind");
    const ownerSession = await createAuthenticatedSession(baseUrl, username);
    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "Rebind Match" })
    });
    assert.equal(created.status, 201);
    const createdPayload: any = await readJson(created);

    const joinHuman = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ sessionToken: ownerSession.sessionToken })
    });
    assert.equal(joinHuman.status, 200);
    const humanJoinPayload: any = await readJson(joinHuman);

    const joinAi = await fetch(baseUrl + "/api/ai/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CPU Rebind" })
    });
    assert.equal(joinAi.status, 201);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ sessionToken: ownerSession.sessionToken, playerId: humanJoinPayload.playerId })
    });
    assert.equal(startResponse.status, 200);

    const logoutResponse = await fetch(baseUrl + "/api/auth/logout", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ sessionToken: ownerSession.sessionToken })
    });
    assert.equal(logoutResponse.status, 200);

    const reloginResponse = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: TEST_PASSWORD })
    });
    assert.equal(reloginResponse.status, 200);
    const reloginBody: any = await readJson(reloginResponse);
    const reloginPayload = {
      ...reloginBody,
      sessionToken: sessionTokenFromSetCookie(reloginResponse.headers.get("set-cookie"))
    };

    const reopened = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: authHeaders(reloginPayload.sessionToken),
      body: JSON.stringify({ gameId: createdPayload.game.id })
    });
    assert.equal(reopened.status, 200);
    const reopenedPayload: any = await readJson(reopened);
    assert.equal(reopenedPayload.playerId, humanJoinPayload.playerId);

    const ownedTerritory = reopenedPayload.state.map.find((territory: any) => territory.ownerId === humanJoinPayload.playerId);
    const reinforceResponse = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(reloginPayload.sessionToken),
      body: JSON.stringify({
        sessionToken: reloginPayload.sessionToken,
        playerId: reopenedPayload.playerId,
        type: "reinforce",
        territoryId: ownedTerritory.id,
        expectedVersion: reopenedPayload.state.version
      })
    });
    assert.equal(reinforceResponse.status, 200);
  });
});
register("API cards trade applica un set valido e persiste lo stato aggiornato", async () => {
  await withServer(async (baseUrl, context) => {
    const login = await createAuthenticatedAppSession(context.app, uniqueName("trade_api"));
    const state = createInitialState();
    const first = addPlayer(state, login.user.username, { linkedUserId: login.user.id }).player;
    addPlayer(state, "CPU Trade", { isAi: true });
    state.phase = "active";
    state.turnPhase = "reinforcement";
    state.currentTurnIndex = 0;
    state.reinforcementPool = 3;
    state.hands[first.id] = [
      createCard({ id: "api-t1", type: CardType.INFANTRY }),
      createCard({ id: "api-t2", type: CardType.INFANTRY }),
      createCard({ id: "api-t3", type: CardType.INFANTRY })
    ];

    Object.keys(context.app.state).forEach((key) => delete context.app.state[key]);
    Object.assign(context.app.state, state);

    const response = await callApp(context.app, "POST", "/api/cards/trade", {
      sessionToken: login.sessionToken,
      playerId: first.id,
      cardIds: ["api-t1", "api-t2", "api-t3"]
    }, authHeaders(login.sessionToken));

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.bonus, 4);
    assert.equal(response.payload.state.reinforcementPool, 7);
    assert.equal(response.payload.state.cardState.discardCount, 3);
    assert.equal(response.payload.state.players.find((player: any) => player.id === first.id).cardCount, 0);
    assert.deepEqual(context.app.state.discardPile.map((card: any) => card.id), ["api-t1", "api-t2", "api-t3"]);
  });
});

register("API card flow rimescola il discard e continua l'award a fine turno", async () => {
  await withServer(async (baseUrl, context) => {
    const login = await createAuthenticatedAppSession(context.app, uniqueName("card_flow"));
    const state = createInitialState();
    const first = addPlayer(state, login.user.username, { linkedUserId: login.user.id }).player;
    addPlayer(state, 'CPU Card', { isAi: true });
    state.phase = 'active';
    state.turnPhase = 'reinforcement';
    state.currentTurnIndex = 0;
    state.reinforcementPool = 3;
    state.territories.aurora = { ownerId: first.id, armies: 2 };
    state.territories.bastion = { ownerId: first.id, armies: 1 };
    const cpu = state.players.find((player: any) => player.id !== first.id);
    state.territories.cinder = { ownerId: cpu.id, armies: 2 };
    state.territories.delta = { ownerId: cpu.id, armies: 1 };
    state.hands[first.id] = [
      createCard({ id: 'flow-t1', type: CardType.INFANTRY }),
      createCard({ id: 'flow-t2', type: CardType.INFANTRY }),
      createCard({ id: 'flow-t3', type: CardType.INFANTRY })
    ];

    Object.keys(context.app.state).forEach((key) => delete context.app.state[key]);
    Object.assign(context.app.state, state);

    const tradeResponse = await callApp(context.app, 'POST', '/api/cards/trade', {
      sessionToken: login.sessionToken,
      playerId: first.id,
      cardIds: ['flow-t1', 'flow-t2', 'flow-t3']
    }, authHeaders(login.sessionToken));

    assert.equal(tradeResponse.statusCode, 200);
    assert.deepEqual(context.app.state.discardPile.map((card: any) => card.id), ['flow-t1', 'flow-t2', 'flow-t3']);

    context.app.state.reinforcementPool = 0;
    context.app.state.turnPhase = 'fortify';
    context.app.state.conqueredTerritoryThisTurn = true;
    context.app.state.deck = [];

    const endTurnResponse = await callApp(context.app, 'POST', '/api/action', {
      sessionToken: login.sessionToken,
      playerId: first.id,
      type: 'endTurn'
    }, authHeaders(login.sessionToken));

    assert.equal(endTurnResponse.statusCode, 200);
    assert.equal(endTurnResponse.payload.state.cardState.discardCount, 0);
    assert.equal(endTurnResponse.payload.state.cardState.deckCount >= 1, true);
    assert.equal(context.app.state.hands[first.id].length, 1);
    assert.equal(['flow-t1', 'flow-t2', 'flow-t3'].includes(context.app.state.hands[first.id][0].id), true);
    assert.equal(context.app.state.discardPile.length, 0);
    assert.equal(context.app.state.deck.length >= 1, true);
    assert.equal(context.app.state.conqueredTerritoryThisTurn, false);
  });
});

register("API cards trade rifiuta set invalidi senza mutare lo stato", async () => {
  await withServer(async (baseUrl, context) => {
    const login = await createAuthenticatedAppSession(context.app, uniqueName("trade_invalid"));
    const state = createInitialState();
    const first = addPlayer(state, login.user.username, { linkedUserId: login.user.id }).player;
    addPlayer(state, "CPU Trade", { isAi: true });
    state.phase = "active";
    state.turnPhase = "reinforcement";
    state.currentTurnIndex = 0;
    state.reinforcementPool = 3;
    state.hands[first.id] = [
      createCard({ id: "bad-t1", type: CardType.INFANTRY }),
      createCard({ id: "bad-t2", type: CardType.INFANTRY }),
      createCard({ id: "bad-t3", type: CardType.CAVALRY })
    ];

    Object.keys(context.app.state).forEach((key) => delete context.app.state[key]);
    Object.assign(context.app.state, state);

    const response = await callApp(context.app, "POST", "/api/cards/trade", {
      sessionToken: login.sessionToken,
      playerId: first.id,
      cardIds: ["bad-t1", "bad-t2", "bad-t3"]
    }, authHeaders(login.sessionToken));

    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.error, "Card set does not match a valid standard trade.");
    assert.equal(context.app.state.reinforcementPool, 3);
    assert.equal(context.app.state.tradeCount, 0);
    assert.equal(context.app.state.discardPile.length, 0);
    assert.equal(context.app.state.hands[first.id].length, 3);
  });
});

register("API ai join + endTurn esegue automaticamente il turno AI", async () => {
  await withServer(async (baseUrl) => {
    const ownerSession = await createAuthenticatedSession(baseUrl, uniqueName("ai_owner"));
    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "AI Match" })
    });
    assert.equal(created.status, 201);

    const username = uniqueName("cpu_host");

    const humanSession = ownerSession;

    const joinHuman = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(humanSession.sessionToken),
      body: JSON.stringify({ sessionToken: humanSession.sessionToken })
    });
    assert.equal(joinHuman.status, 200);
    const humanJoinPayload: any = await readJson(joinHuman);

    const joinAi = await fetch(baseUrl + "/api/ai/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CPU Basic" })
    });
    assert.equal(joinAi.status, 201);
    const aiJoinPayload: any = await readJson(joinAi);
    assert.equal(aiJoinPayload.player.isAi, true);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(humanSession.sessionToken),
      body: JSON.stringify({ sessionToken: humanSession.sessionToken, playerId: humanJoinPayload.playerId })
    });
    assert.equal(startResponse.status, 200);
    const started: any = await readJson(startResponse);
    assert.equal(started.state.players.some((player: any) => player.isAi), true);

    const ownedTerritoryId = started.state.map.find((territory: any) => territory.ownerId === humanJoinPayload.playerId).id;
    let currentState = started.state;

    while (currentState.reinforcementPool > 0) {
      const reinforceResponse = await fetch(baseUrl + "/api/action", {
        method: "POST",
        headers: authHeaders(humanSession.sessionToken),
        body: JSON.stringify({
          sessionToken: humanSession.sessionToken,
          playerId: humanJoinPayload.playerId,
          type: "reinforce",
          territoryId: ownedTerritoryId
        })
      });
      assert.equal(reinforceResponse.status, 200);
      currentState = (await readJson(reinforceResponse)).state;
    }

    const toFortify = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(humanSession.sessionToken),
      body: JSON.stringify({
        sessionToken: humanSession.sessionToken,
        playerId: humanJoinPayload.playerId,
        type: "endTurn"
      })
    });
    assert.equal(toFortify.status, 200);

    const finishTurn = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(humanSession.sessionToken),
      body: JSON.stringify({
        sessionToken: humanSession.sessionToken,
        playerId: humanJoinPayload.playerId,
        type: "endTurn"
      })
    });
    assert.equal(finishTurn.status, 200);
    const finishedPayload: any = await readJson(finishTurn);

    assert.equal(finishedPayload.state.currentPlayerId, humanJoinPayload.playerId);
    assert.equal(finishedPayload.state.turnPhase, "reinforcement");
    assert.equal(finishedPayload.state.reinforcementPool >= 3, true);
    assert.equal(finishedPayload.state.log.some((line: any) => line.indexOf("CPU Basic") !== -1), true);
  });
});

register("API games open riprende automaticamente una partita salvata sul turno AI", async () => {
  await withServer(async (baseUrl) => {
    const ownerSession = await createAuthenticatedSession(baseUrl, uniqueName("resume_ai_owner"));
    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "Resume AI Match" })
    });
    assert.equal(created.status, 201);

    const joinHuman = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ sessionToken: ownerSession.sessionToken })
    });
    assert.equal(joinHuman.status, 200);
    const humanJoinPayload: any = await readJson(joinHuman);

    const joinAi = await fetch(baseUrl + "/api/ai/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CPU Resume" })
    });
    assert.equal(joinAi.status, 201);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ sessionToken: ownerSession.sessionToken, playerId: humanJoinPayload.playerId })
    });
    assert.equal(startResponse.status, 200);
    let currentState: any = (await readJson(startResponse)).state;

    const ownedTerritoryId = currentState.map.find((territory: any) => territory.ownerId === humanJoinPayload.playerId).id;

    while (currentState.reinforcementPool > 0) {
      const reinforceResponse = await fetch(baseUrl + "/api/action", {
        method: "POST",
        headers: authHeaders(ownerSession.sessionToken),
        body: JSON.stringify({
          sessionToken: ownerSession.sessionToken,
          playerId: humanJoinPayload.playerId,
          type: "reinforce",
          territoryId: ownedTerritoryId
        })
      });
      assert.equal(reinforceResponse.status, 200);
      currentState = (await readJson(reinforceResponse)).state;
    }

    const toFortify = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({
        sessionToken: ownerSession.sessionToken,
        playerId: humanJoinPayload.playerId,
        type: "endTurn"
      })
    });
    assert.equal(toFortify.status, 200);

    const finishTurn = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({
        sessionToken: ownerSession.sessionToken,
        playerId: humanJoinPayload.playerId,
        type: "endTurn"
      })
    });
    assert.equal(finishTurn.status, 200);

    const stateDuringAiTurn = await fetch(baseUrl + "/api/state", {
      headers: authHeaders(ownerSession.sessionToken)
    });
    assert.equal(stateDuringAiTurn.status, 200);
    const resumedPayload: any = await readJson(stateDuringAiTurn);

    assert.equal(resumedPayload.currentPlayerId, humanJoinPayload.playerId);
    assert.equal(resumedPayload.turnPhase, "reinforcement");
    assert.equal(resumedPayload.reinforcementPool >= 3, true);
    assert.equal(resumedPayload.log.some((line: any) => line.indexOf("CPU Resume") !== -1), true);

    const reopenResponse = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ gameId: resumedPayload.gameId })
    });
    assert.equal(reopenResponse.status, 200);
    const reopenPayload: any = await readJson(reopenResponse);

    assert.equal(reopenPayload.state.currentPlayerId, humanJoinPayload.playerId);
    assert.equal(reopenPayload.state.turnPhase, "reinforcement");
  });
});

register("API games open consente all'admin di aprire una partita protetta altrui", async () => {
  await withServer(async (baseUrl, context) => {
    const ownerSession = await createAuthenticatedSession(baseUrl, uniqueName("owner_admin_open"));
    const adminSession = await createAuthenticatedSession(baseUrl, uniqueName("admin_open"));

    setStoredUserRole(context.app.datastore, adminSession.user.username, "admin");

    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "Admin open test" })
    });
    assert.equal(created.status, 201);
    const createdPayload: any = await readJson(created);

    const openResponse = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: authHeaders(adminSession.sessionToken),
      body: JSON.stringify({ gameId: createdPayload.game.id })
    });
    assert.equal(openResponse.status, 200);
    const openPayload: any = await readJson(openResponse);
    assert.equal(openPayload.game.id, createdPayload.game.id);
  });
});

register("API start consente all'admin di avviare una partita protetta altrui", async () => {
  await withServer(async (baseUrl, context) => {
    const ownerSession = await createAuthenticatedSession(baseUrl, uniqueName("owner_admin_start"));
    const adminSession = await createAuthenticatedSession(baseUrl, uniqueName("admin_start"));

    setStoredUserRole(context.app.datastore, adminSession.user.username, "admin");

    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "Admin start test" })
    });
    assert.equal(created.status, 201);

    const ownerJoin = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ sessionToken: ownerSession.sessionToken })
    });
    assert.equal(ownerJoin.status, 200);

    const openResponse = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: authHeaders(adminSession.sessionToken),
      body: JSON.stringify({ gameId: (await readJson(created)).game.id })
    });
    assert.equal(openResponse.status, 200);

    const adminJoin = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(adminSession.sessionToken),
      body: JSON.stringify({ sessionToken: adminSession.sessionToken })
    });
    assert.equal(adminJoin.status, 201);
    const adminJoinPayload: any = await readJson(adminJoin);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(adminSession.sessionToken),
      body: JSON.stringify({ sessionToken: adminSession.sessionToken, playerId: adminJoinPayload.playerId })
    });
    assert.equal(startResponse.status, 200);
    const startPayload: any = await readJson(startResponse);
    assert.equal(startPayload.state.phase, "active");
  });
});
register("API profile espone statistiche giocatore aggregate", async () => {
  await withServer(async (baseUrl) => {
    const ownerSession = await createAuthenticatedSession(baseUrl, uniqueName("profile_owner"));
    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "Profilo test" })
    });
    assert.equal(created.status, 201);

    const username = uniqueName("prof");
    const other = uniqueName("enem");

    const registerOther = await fetch(baseUrl + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: other, password: TEST_PASSWORD })
    });
    assert.equal(registerOther.status, 201);

    const userSession = ownerSession;

    const joinUser = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(userSession.sessionToken),
      body: JSON.stringify({ sessionToken: userSession.sessionToken })
    });
    const joinUserPayload: any = await readJson(joinUser);

    const loginOther = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: other, password: TEST_PASSWORD })
    });
    const otherSessionBody: any = await readJson(loginOther);
    const otherSession = {
      ...otherSessionBody,
      sessionToken: sessionTokenFromSetCookie(loginOther.headers.get("set-cookie"))
    };

    const joinOther = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(otherSession.sessionToken),
      body: JSON.stringify({ sessionToken: otherSession.sessionToken })
    });
    assert.equal(joinOther.status, 201);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(userSession.sessionToken),
      body: JSON.stringify({ sessionToken: userSession.sessionToken, playerId: joinUserPayload.playerId })
    });
    assert.equal(startResponse.status, 200);

    const profileResponse = await fetch(baseUrl + "/api/profile", {
      headers: authHeaders(userSession.sessionToken)
    });
    assert.equal(profileResponse.status, 200);
    const profilePayload: any = await readJson(profileResponse);
    assert.equal(profilePayload.profile.playerName, userSession.user.username);
    assert.equal(profilePayload.profile.gamesInProgress, 1);
    assert.equal(profilePayload.profile.gamesPlayed, 0);
    assert.equal(profilePayload.profile.winRate, null);
  });
});

register("API profile preferences theme persiste il tema utente validato", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAuthenticatedSession(baseUrl, uniqueName("profile_theme_api"));

    const themeResponse = await fetch(baseUrl + "/api/profile/preferences/theme", {
      method: "PUT",
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify({ theme: "midnight" })
    });
    assert.equal(themeResponse.status, 200);
    const themePayload: any = await readJson(themeResponse);
    assert.equal(themePayload.preferences.theme, "midnight");
    assert.equal(themePayload.user.preferences.theme, "midnight");

    const profileResponse = await fetch(baseUrl + "/api/profile", {
      headers: authHeaders(session.sessionToken)
    });
    assert.equal(profileResponse.status, 200);
    const profilePayload: any = await readJson(profileResponse);
    assert.equal(profilePayload.profile.preferences.theme, "midnight");

    const invalidThemeResponse = await fetch(baseUrl + "/api/profile/preferences/theme", {
      method: "PUT",
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify({ theme: "unknown-theme" })
    });
    assert.equal(invalidThemeResponse.status, 400);
  });
});

register("GET /api/state risponde con lo stato pubblico", async () => {
  await withServer(async (baseUrl, context) => {
    const state = createInitialState();
    const first = addPlayer(state, "Alice").player;
    addPlayer(state, "Bob");
    state.phase = "active";
    state.turnPhase = "reinforcement";
    state.currentTurnIndex = 0;
    state.hands[first.id] = [
      createCard({ id: "m1", type: CardType.INFANTRY }),
      createCard({ id: "m2", type: CardType.INFANTRY }),
      createCard({ id: "m3", type: CardType.INFANTRY }),
      createCard({ id: "m4", type: CardType.CAVALRY }),
      createCard({ id: "m5", type: CardType.ARTILLERY }),
      createCard({ id: "m6", type: CardType.WILD })
    ];
    Object.keys(context.app.state).forEach((key) => delete context.app.state[key]);
    Object.assign(context.app.state, state);

    const response = await fetch(`${baseUrl}/api/state`);
    assert.equal(response.status, 200);
    const payload: any = await readJson(response);
    assert.equal(Array.isArray(payload.map), true);
    assert.equal(Array.isArray(payload.continents), true);
    assert.equal(payload.cardState.maxHandBeforeForcedTrade, STANDARD_MAX_HAND_BEFORE_FORCED_TRADE);
    assert.equal(payload.cardState.currentPlayerMustTrade, true);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "playerHand"), false);
  });
});

register("GET /api/health espone lo stato del datastore sqlite", async () => {
  await withServer(async (baseUrl, context) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const payload: any = await readJson(response);
    assert.equal(payload.ok, true);
    assert.equal(payload.storage.storage, "sqlite");
    assert.equal(payload.storage.journalMode, "WAL");
    assert.equal(payload.storage.dbFile, context.tempDbFile);
    assert.equal(typeof payload.storage.counts.users, "number");
    assert.equal(typeof payload.storage.counts.games, "number");
    assert.equal(typeof payload.storage.counts.sessions, "number");
    assert.equal(payload.hasActiveGame, true);
  });
});

register("datastore supabase espone healthSummary async quando configurato via env", async () => {
  await withMockSupabase(async () => {
    const datastore = createDatastore({
      legacyUsersFile: null,
      legacyGamesFile: null,
      legacySessionsFile: null
    });

    const health = await datastore.healthSummary();
    assert.equal(datastore.driver, "supabase");
    assert.equal(health.ok, true);
    assert.equal(health.storage, "supabase");
    assert.equal(health.url, "https://example.supabase.co");
    assert.equal(health.schema, "public");
    assert.deepEqual(health.counts, { users: 0, games: 0, sessions: 0 });

    datastore.close();
  });
});

register("app usa Supabase per auth/session e non crea sqlite locale quando il driver e remoto", async () => {
  await withMockSupabase(async (mock) => {
    const unique = `${Date.now()}-${uniqueSuffix()}`;
    const tempFile = path.join(__dirname, `tmp-supabase-users-${unique}.json`);
    const tempGamesFile = path.join(__dirname, `tmp-supabase-games-${unique}.json`);
    const tempSessionsFile = path.join(__dirname, `tmp-supabase-sessions-${unique}.json`);
    const tempDbFile = path.join(__dirname, `tmp-supabase-store-${unique}.sqlite`);
    const app = createApp({
      dataFile: tempFile,
      gamesFile: tempGamesFile,
      sessionsFile: tempSessionsFile,
      dbFile: tempDbFile
    });

    try {
      const registered = await app.auth.registerPasswordUser("supa_tester", "secret123123");
      assert.equal(registered.ok, true);

      const login = await app.auth.loginWithPassword("supa_tester", "secret123123");
      assert.equal(login.ok, true);
      assert.equal(typeof login.sessionToken, "string");

      const sessionResponse = await callApp(app, "GET", "/api/auth/session", undefined, authHeaders(login.sessionToken));
      assert.equal(sessionResponse.statusCode, 200);
      assert.equal(sessionResponse.payload.user.username, "supa_tester");

      const healthResponse = await callApp(app, "GET", "/api/health");
      assert.equal(healthResponse.statusCode, 200);
      assert.equal(healthResponse.payload.storage.storage, "supabase");

      assert.equal(mock.tables.users.length, 1);
      assert.equal(mock.tables.sessions.length, 1);
      assert.equal(typeof JSON.parse(mock.tables.users[0].credentials_json).password.hash, "string");
      assert.equal(fs.existsSync(tempDbFile), false);
    } finally {
      app.datastore.close();
      [tempFile, tempGamesFile, tempSessionsFile].forEach((target) => {
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
        }
      });
      cleanupSqliteFiles(tempDbFile);
    }
  });
});

register("GET /api/state espone lastCombat dopo un attacco", async () => {
  await withServer(async (baseUrl, context) => {
    const state = createInitialState();
    const first = addPlayer(state, "Alice").player;
    const second = addPlayer(state, "Bob").player;
    state.phase = "active";
    state.turnPhase = "attack";
    state.currentTurnIndex = 0;
    state.reinforcementPool = 0;
    state.territories.aurora = { ownerId: first.id, armies: 3 };
    state.territories.bastion = { ownerId: second.id, armies: 1 };

    const random = (() => {
      const values = [0.9, 0.7, 0.1];
      return () => values.shift();
    })();

    const attack = resolveAttack(state, first.id, "aurora", "bastion", random);
    assert.equal(attack.ok, true);

    Object.keys(context.app.state).forEach((key) => delete context.app.state[key]);
    Object.assign(context.app.state, state);

    const response = await fetch(`${baseUrl}/api/state`);
    assert.equal(response.status, 200);
    const payload: any = await readJson(response);
    assert.deepEqual(payload.lastCombat, attack.combat);
    assert.equal(payload.lastCombat.comparisons[0].winner, "attacker");
    assert.equal(payload.lastCombat.conqueredTerritory, true);
  });
});

register("API state espone solo la mano del player autenticato risolto", async () => {
  await withServer(async (baseUrl, context) => {
    const login = await createAuthenticatedAppSession(context.app, uniqueName("hand_state"));
    const state = createInitialState();
    const first = addPlayer(state, login.user.username, { linkedUserId: login.user.id }).player;
    addPlayer(state, "CPU Observer", { isAi: true });
    state.phase = "active";
    state.turnPhase = "reinforcement";
    state.currentTurnIndex = 0;
    state.hands[first.id] = [
      createCard({ id: "hand-1", type: CardType.INFANTRY, territoryId: "aurora" }),
      createCard({ id: "hand-2", type: CardType.CAVALRY, territoryId: "bastion" }),
      createCard({ id: "hand-3", type: CardType.WILD })
    ];
    Object.keys(context.app.state).forEach((key) => delete context.app.state[key]);
    Object.assign(context.app.state, state);

    const response = await callApp(context.app, "GET", "/api/state", undefined, authHeaders(login.sessionToken));
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.playerId, first.id);
    assert.equal(Array.isArray(response.payload.playerHand), true);
    assert.deepEqual(response.payload.playerHand.map((card: any) => card.id), ["hand-1", "hand-2", "hand-3"]);
    assert.equal(response.payload.players.find((player: any) => player.id === first.id).cardCount, 3);
    assert.equal(Object.prototype.hasOwnProperty.call(response.payload.players[0], "hand"), false);
  });
});

register("API surrender mantiene lo snapshot per-user anche dopo la resa", async () => {
  await withServer(async (baseUrl) => {
    const ownerSession = await createAuthenticatedSession(baseUrl, uniqueName("surrender_owner"));
    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ name: "Surrender snapshot" })
    });
    assert.equal(created.status, 201);

    const joinOwner = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ sessionToken: ownerSession.sessionToken })
    });
    assert.equal(joinOwner.status, 200);
    const ownerPayload: any = await readJson(joinOwner);

    const otherSession = await createAuthenticatedSession(baseUrl, uniqueName("surrender_other"));
    const joinOther = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: authHeaders(otherSession.sessionToken),
      body: JSON.stringify({ sessionToken: otherSession.sessionToken })
    });
    assert.equal(joinOther.status, 201);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({ sessionToken: ownerSession.sessionToken, playerId: ownerPayload.playerId })
    });
    assert.equal(startResponse.status, 200);

    const response = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: authHeaders(ownerSession.sessionToken),
      body: JSON.stringify({
        sessionToken: ownerSession.sessionToken,
        playerId: ownerPayload.playerId,
        type: "surrender"
      })
    });

    assert.equal(response.status, 200);
    const payload: any = await readJson(response);
    assert.equal(payload.state.playerId, ownerPayload.playerId);
    assert.equal(payload.state.players.find((player: any) => player.id === ownerPayload.playerId).surrendered, true);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "rounds"), false);
  });
});

register("API register + login + join completa il flusso di accesso", async () => {
  await withServer(async (baseUrl) => {
  const unique = `api_${Date.now()}_${uniqueSuffix()}`;
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: unique, password: TEST_PASSWORD })
    });
    assert.equal(registerResponse.status, 201);

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: unique, password: TEST_PASSWORD })
    });
    assert.equal(loginResponse.status, 200);
    const loginBody: any = await readJson(loginResponse);
    const loginPayload = {
      ...loginBody,
      sessionToken: sessionTokenFromSetCookie(loginResponse.headers.get("set-cookie"))
    };

    const joinResponse = await fetch(`${baseUrl}/api/join`, {
      method: "POST",
      headers: authHeaders(loginPayload.sessionToken),
      body: JSON.stringify({ sessionToken: loginPayload.sessionToken })
    });
    assert.equal(joinResponse.status, 201);
  });
});

async function run() {
  let failures = 0;
  for (const test of tests) {
    try {
      await test.fn();
      console.log("PASS", test.name);
    } catch (error: any) {
      failures += 1;
      console.error("FAIL", test.name);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} test non superati.`);
    process.exit(1);
  }

  console.log(`\n${tests.length} test superati.`);
}

run();
