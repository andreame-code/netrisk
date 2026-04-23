const http = require("http");
const crypto = require("node:crypto");
const fs = require("fs");
const path = require("path");
const { createAdminConsole } = require("./admin-console.cjs");
const { loadLocalEnv } = require("./load-local-env.cjs");
const { createDatastore } = require("./datastore.cjs");
const { createAuthoredModulesService } = require("./authored-modules.cjs");
const { createModuleRuntime } = require("./module-runtime.cjs");
const { createAuthStore } = require("./auth.cjs");
const { authorize } = require("./authorization.cjs");
const { createGameSessionStore } = require("./game-session-store.cjs");
const { createPlayerProfileStore } = require("./player-profile-store.cjs");
const {
  createConfiguredInitialState,
  listTurnTimeoutHoursOptions
} = require("./new-game-config.cjs");
const { secureRandom } = require("./random.cjs");
const { isPromiseLike } = require("./maybe-async.cjs");
const { missingRequiredDeployEnv, shouldValidateDeployEnv } = require("./required-runtime-env.cjs");
const { parseSentryOrigin, resolveObservabilityRelease } = require("./observability.cjs");
const {
  addPlayer,
  createInitialState,
  forceEndTurn,
  getPlayer,
  getAssignedVictoryObjectiveForPlayer,
  publicState,
  startGame,
  tradeCardSet
} = require("./engine/game-engine.cjs");
const { listSupportedThemeIds, resolveStoredThemeId } = require("../shared/extensions.cjs");
const { runAiTurnsIfNeeded } = require("./engine/ai-turn-resume.cjs");
const { recoverAiTurnState } = require("./services/ai-turn-recovery.cjs");
const { runScheduledJobs } = require("./scheduler/index.cjs");
const { createLocalizedError } = require("../shared/messages.cjs");
const {
  localizedPayload,
  sendJson,
  sendLocalizedError,
  setResponseRequestContext
} = require("./http-response.cjs");
const { broadcastEventPayload } = require("./event-broadcast.cjs");
const {
  handleAccountSettingsRoute,
  handleAuthSessionRoute,
  handleProfileRoute,
  handleThemePreferenceRoute
} = require("./routes/account.cjs");
const { handleGameActionRoute } = require("./routes/game-actions.cjs");
const { handleCardsTradeRoute } = require("./routes/game-cards.cjs");
const { handleCreateGameRoute, handleOpenGameRoute } = require("./routes/game-management.cjs");
const { handleGamesListRoute, handleGameOptionsRoute } = require("./routes/game-overview.cjs");
const { handleEventsRoute, handleStateRoute } = require("./routes/game-read.cjs");
const { handleAiJoinRoute, handleJoinRoute, handleStartRoute } = require("./routes/game-setup.cjs");
const { handleHealthRoute } = require("./routes/health.cjs");
const {
  handleDisableModuleRoute,
  handleEnableModuleRoute,
  handleListModulesRoute,
  handleModuleOptionsRoute,
  handleRescanModulesRoute
} = require("./routes/modules.cjs");
const {
  handleAdminContentStudioCreateRoute,
  handleAdminContentStudioModuleDetailRoute,
  handleAdminContentStudioDisableRoute,
  handleAdminContentStudioEnableRoute,
  handleAdminContentStudioModulesRoute,
  handleAdminContentStudioOptionsRoute,
  handleAdminContentStudioPublishRoute,
  handleAdminContentStudioUpdateRoute,
  handleAdminContentStudioValidateRoute
} = require("./routes/admin-content-studio.cjs");
const {
  handleAdminAuditRoute,
  handleAdminConfigRoute,
  handleAdminConfigUpdateRoute,
  handleAdminGameActionRoute,
  handleAdminGameDetailRoute,
  handleAdminGamesRoute,
  handleAdminMaintenanceActionRoute,
  handleAdminMaintenanceRoute,
  handleAdminOverviewRoute,
  handleAdminUserRoleRoute,
  handleAdminUsersRoute
} = require("./routes/admin.cjs");
const {
  handleLoginRoute,
  handleLogoutRoute,
  handleRegisterRoute
} = require("./routes/password-auth.cjs");
const { handleScheduledJobsRoute } = require("./routes/scheduled-jobs.cjs");
const { NETRISK_ENGINE_VERSION } = require("../shared/netrisk-modules.cjs");
const { gameEventPayloadSchema } = require("../shared/runtime-validation.cjs");

type Request = import("http").IncomingMessage;
type Response = import("http").ServerResponse;
type CookieMap = Record<string, string>;
type AppUser = {
  id: string;
  username: string;
  profile?: {
    preferences?: {
      theme?: string;
    };
  };
  preferences?: {
    theme?: string;
  };
};
type CreateAppOptions = {
  dbFile?: string;
  dataFile?: string;
  gamesFile?: string;
  sessionsFile?: string;
  projectRoot?: string;
};
type GameContext = {
  gameId: string | null;
  gameName: string | null;
  version: number | null;
  state: any;
};
type EventClient = {
  res: Response;
  user: unknown;
};
type RequestWithId = Request & {
  __netriskRequestId?: string;
};

loadLocalEnv();

function resolveProjectRoot() {
  const candidates = [];

  if (process.env.NETRISK_PROJECT_ROOT) {
    candidates.push(process.env.NETRISK_PROJECT_ROOT);
  }

  candidates.push(process.cwd());
  candidates.push(path.join(__dirname, ".."));
  candidates.push(path.join(__dirname, "..", ".."));
  const seen = new Set();

  for (const candidate of candidates) {
    const absolute = path.resolve(candidate);
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);

    const publicPath = path.join(absolute, "public");
    const dataPath = path.join(absolute, "data");

    if (fs.existsSync(publicPath) && fs.existsSync(dataPath)) {
      return absolute;
    }
  }

  return path.resolve(process.cwd());
}

const projectRoot = resolveProjectRoot();
const port = process.env.PORT || 3000;
const sessionCookieName = "netrisk_session";
const supportedSiteThemes = new Set(listSupportedThemeIds());

function logAiRecovery(payload: {
  event: "ai_turn_recovery";
  gameId: string | null;
  gameName: string | null;
  version: number | null;
  source: "read" | "scheduler" | "mutation" | "unknown";
  playerId: string;
  forcedTurn: boolean;
  interceptedError: boolean;
  reportsCount: number;
  turnPhaseBefore: string | null;
  turnStartedAtBefore: string | null;
}) {
  console.info(JSON.stringify(payload));
}

function resolveStoredTheme(theme: unknown): string {
  return resolveStoredThemeId(theme);
}

function extractUserPreferences(user: AppUser | null | undefined) {
  return {
    theme: resolveStoredTheme(user?.profile?.preferences?.theme)
  };
}

function defaultDbFile() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "netrisk.sqlite");
  }

  return path.join(projectRoot, "data", "netrisk.sqlite");
}

function parseBody(req: Request): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer | string) => {
      raw += chunk;
      if (raw.length > 1000000) {
        reject(createLocalizedError("Payload troppo grande", "server.payloadTooLarge"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw) as Record<string, any>);
      } catch (error) {
        reject(createLocalizedError("JSON non valido", "server.invalidJson"));
      }
    });
  });
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function parseCookies(req: Request): CookieMap {
  const rawCookies = String(req.headers.cookie || "");
  if (!rawCookies) {
    return {};
  }

  return rawCookies.split(";").reduce((cookies, entry) => {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      return cookies;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      return cookies;
    }

    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {} as CookieMap);
}

function secureCookieFlag(req: Request): boolean {
  return Boolean((req.socket as any)?.encrypted) || req.headers["x-forwarded-proto"] === "https";
}

function buildSessionCookie(req: Request, sessionToken: string): string {
  const parts = [
    `${sessionCookieName}=${encodeURIComponent(sessionToken)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax"
  ];
  if (secureCookieFlag(req)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function clearSessionCookie(req: Request): string {
  const parts = [`${sessionCookieName}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secureCookieFlag(req)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function createApp(options: CreateAppOptions = {}) {
  const runtimeProjectRoot = options.projectRoot || projectRoot;
  const runtimePublicDir = path.join(runtimeProjectRoot, "public");
  const runtimeModulesDir = path.join(runtimeProjectRoot, "modules");
  const runtimeRelease = resolveObservabilityRelease(process.env);
  const sentryConnectOrigin = parseSentryOrigin(process.env.VITE_SENTRY_DSN);

  if (shouldValidateDeployEnv(process.env)) {
    const missingEnvKeys = missingRequiredDeployEnv(process.env);
    if (missingEnvKeys.length) {
      throw createLocalizedError(
        "Configurazione Vercel incompleta.",
        "server.deploy.missingEnv",
        { keys: missingEnvKeys.join(", ") },
        "MISSING_DEPLOY_ENV"
      );
    }
  }

  const state = createInitialState();
  let activeGameId: string | null = null;
  let activeGameVersion: number | null = null;
  let activeGameName: string | null = null;
  let nextAttackRolls: number[] | null = null;
  const datastore = createDatastore({
    dbFile: options.dbFile || defaultDbFile(),
    legacyUsersFile: options.dataFile || path.join(runtimeProjectRoot, "data", "users.json"),
    legacyGamesFile: options.gamesFile || path.join(runtimeProjectRoot, "data", "games.json"),
    legacySessionsFile:
      options.sessionsFile || path.join(runtimeProjectRoot, "data", "sessions.json")
  });
  const authoredModules = createAuthoredModulesService({
    datastore
  });
  const moduleRuntime = createModuleRuntime({
    projectRoot: runtimeProjectRoot,
    datastore,
    authoredModules
  });
  authoredModules.setMapCatalog({
    listMaps: () => moduleRuntime.listSupportedMaps(),
    resolveMap: (mapId: string) => moduleRuntime.findSupportedMap(mapId)
  });
  const resolveCatalogMapName = (mapId: string | null | undefined) => {
    if (typeof mapId !== "string" || !mapId.trim()) {
      return null;
    }

    const map = moduleRuntime.findSupportedMap(mapId);
    return map ? map.name : mapId;
  };
  const gamesFile = options.gamesFile || path.join(runtimeProjectRoot, "data", "games.json");
  const gameSessions = createGameSessionStore({
    datastore,
    dataFile: gamesFile,
    resolveMapName: resolveCatalogMapName
  });
  const playerProfiles = createPlayerProfileStore({
    datastore,
    gamesFile,
    resolveMapName: resolveCatalogMapName
  });
  const auth = createAuthStore({
    datastore,
    dataFile: options.dataFile || path.join(runtimeProjectRoot, "data", "users.json"),
    sessionsFile: options.sessionsFile || path.join(runtimeProjectRoot, "data", "sessions.json")
  });
  const adminConsole = createAdminConsole({
    datastore,
    auth,
    gameSessions,
    loadGameContext,
    persistGameContext,
    broadcastGame,
    createConfiguredInitialState,
    moduleRuntime,
    authoredModules
  });

  async function getSafeAdminDefaults() {
    try {
      const adminConfig = await adminConsole.getConfig();
      return adminConfig.config.defaults;
    } catch (error) {
      return undefined;
    }
  }
  const clientsByGameId = new Map<string, Set<EventClient>>();
  let initPromise: Promise<void> | null = null;
  let initError: unknown = null;

  function beginActiveGameInitialization(initialGameSource: Promise<any> | any): Promise<void> {
    initError = null;
    const nextInitPromise = Promise.resolve(initialGameSource)
      .then((initialGame: any) => {
        activeGameId = initialGame.game.id;
        activeGameVersion = initialGame.game.version;
        activeGameName = initialGame.game.name;
        replaceState(initialGame.state);
      })
      .catch((error: any) => {
        initError = error;
      })
      .finally(() => {
        initPromise = null;
      });
    initPromise = nextInitPromise;
    return nextInitPromise;
  }

  const eagerInitialGame = gameSessions.ensureActiveGame(createInitialState);
  if (isPromiseLike(eagerInitialGame)) {
    void beginActiveGameInitialization(eagerInitialGame);
  } else {
    activeGameId = eagerInitialGame.game.id;
    activeGameVersion = eagerInitialGame.game.version;
    activeGameName = eagerInitialGame.game.name;
    replaceState(eagerInitialGame.state);
  }

  function replaceState(nextState: Record<string, any>) {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, nextState);
  }

  async function initializeActiveGame() {
    if (activeGameId) {
      return;
    }

    if (!initPromise) {
      await beginActiveGameInitialization(gameSessions.ensureActiveGame(createInitialState));
    } else {
      await initPromise;
    }

    if (!activeGameId && initError) {
      throw initError;
    }
  }

  async function persistActiveGame(expectedVersion?: number | null) {
    if (!activeGameId) {
      return null;
    }

    const savedGame = await gameSessions.saveGame(activeGameId, state, expectedVersion);
    activeGameVersion = savedGame.version;
    activeGameName = savedGame.name;
    return savedGame;
  }

  function snapshotForState(
    nextState: any,
    gameId: string | null,
    version: number | null,
    gameName: string | null
  ) {
    return { ...publicState(nextState), gameId, version, gameName };
  }

  function snapshot() {
    return snapshotForState(state, activeGameId, activeGameVersion, activeGameName);
  }

  function getTargetGameId(body: Record<string, any> = {}, url: URL | null = null): string | null {
    return body.gameId || (url ? url.searchParams.get("gameId") : null) || activeGameId || null;
  }

  async function loadGameContext(gameId: string | null): Promise<GameContext> {
    await initializeActiveGame();

    if (!gameId || gameId === activeGameId) {
      return {
        gameId: activeGameId,
        gameName: activeGameName,
        version: activeGameVersion,
        state
      };
    }

    const record = await gameSessions.getGame(gameId);
    return {
      gameId: record.game.id,
      gameName: record.game.name,
      version: record.game.version,
      state: record.state
    };
  }

  async function persistGameContext(gameContext: GameContext, expectedVersion?: number | null) {
    if (!gameContext?.gameId) {
      return null;
    }

    const savedGame = await gameSessions.saveGame(
      gameContext.gameId,
      gameContext.state,
      expectedVersion
    );
    gameContext.version = savedGame.version;
    gameContext.gameName = savedGame.name;

    if (gameContext.gameId === activeGameId) {
      activeGameVersion = savedGame.version;
      activeGameName = savedGame.name;
      if (gameContext.state !== state) {
        replaceState(gameContext.state);
      }
    }

    return savedGame;
  }

  function broadcastGame(gameContext: GameContext) {
    if (!gameContext?.gameId) {
      return;
    }

    const clients = clientsByGameId.get(gameContext.gameId);
    if (!clients || !clients.size) {
      return;
    }

    broadcastEventPayload(clients, (client: EventClient) => {
      const payloadResult = gameEventPayloadSchema.safeParse(
        snapshotForUser(
          gameContext.state,
          gameContext.gameId,
          gameContext.version,
          gameContext.gameName,
          client.user
        )
      );
      if (!payloadResult.success) {
        throw new Error("Invalid gameplay event payload.");
      }

      return "data: " + JSON.stringify(payloadResult.data) + "\n\n";
    });

    if (!clients.size) {
      clientsByGameId.delete(gameContext.gameId);
    }
  }

  async function persistWithAiTurns(gameContext: GameContext, expectedVersion?: number | null) {
    await persistGameContext(gameContext, expectedVersion);
    const aiRecovery = await recoverAiTurnState(gameContext.state, {
      forceEndTurn,
      runAiTurnsIfNeeded,
      logger: logAiRecovery,
      context: {
        gameId: gameContext.gameId,
        gameName: gameContext.gameName,
        version: gameContext.version,
        source: "mutation"
      }
    });
    if (aiRecovery.shouldPersist) {
      await persistGameContext(gameContext, gameContext.version);
    }
    return aiRecovery;
  }

  async function resumeAiTurnsForRead(gameContext: GameContext) {
    const aiRecovery = await recoverAiTurnState(gameContext?.state, {
      forceEndTurn,
      runAiTurnsIfNeeded,
      logger: logAiRecovery,
      context: {
        gameId: gameContext?.gameId || null,
        gameName: gameContext?.gameName || null,
        version: gameContext?.version ?? null,
        source: "read"
      }
    });
    if (!aiRecovery.shouldPersist) {
      return aiRecovery;
    }

    await persistGameContext(gameContext, gameContext.version);
    return aiRecovery;
  }

  function extractSessionToken(
    req: Request,
    body: Record<string, any> = {},
    url: URL | null = null
  ): string | null {
    const cookies = parseCookies(req);
    return cookies[sessionCookieName] || null;
  }

  async function requireAuth(
    req: Request,
    res: Response,
    body: Record<string, any>,
    url: URL | null = null
  ) {
    const sessionToken = extractSessionToken(req, body, url);
    const user = await auth.getUserFromSession(sessionToken);
    if (!user) {
      sendLocalizedError(
        res,
        401,
        null,
        "Sessione non valida.",
        "server.auth.invalidSession",
        {},
        "AUTH_REQUIRED"
      );
      return null;
    }

    return { sessionToken, user };
  }

  async function authorizeGameRead(gameId: string | null, req: Request, res: Response, url: URL) {
    if (!gameId) {
      return { ok: true, user: null, gameRecord: null };
    }

    let gameRecord = null;
    try {
      gameRecord = await gameSessions.getGame(gameId);
    } catch (error) {
      sendLocalizedError(
        res,
        404,
        error,
        "Partita non trovata.",
        "server.game.notFound",
        {},
        "GAME_NOT_FOUND"
      );
      return null;
    }
    if (!gameRecord.game.creatorUserId) {
      return { ok: true, user: null, gameRecord };
    }

    const authContext = await requireAuth(req, res, {}, url);
    if (!authContext) {
      return null;
    }

    try {
      authorize("game:read", {
        user: authContext.user,
        game: gameRecord.game,
        state: gameRecord.state
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      sendLocalizedError(
        res,
        statusCode,
        error,
        "Accesso partita non autorizzato.",
        "server.game.readUnauthorized"
      );
      return null;
    }

    return { ...authContext, gameRecord };
  }

  function resolvePlayerForUser(nextState: any, user: any) {
    if (!user || !nextState || !Array.isArray(nextState.players)) {
      return null;
    }

    return (
      nextState.players.find((player: any) => {
        if (player.isAi) {
          return false;
        }

        if (player.linkedUserId) {
          return player.linkedUserId === user.id;
        }

        return player.name === user.username;
      }) || null
    );
  }

  function playerBelongsToUser(player: any, user: any): boolean {
    if (!player || !user || player.isAi) {
      return false;
    }

    if (player.linkedUserId) {
      return player.linkedUserId === user.id;
    }

    return player.name === user.username;
  }

  function visibleHandForPlayer(nextState: any, player: any): any[] {
    if (!player || !Array.isArray(nextState?.hands?.[player.id])) {
      return [];
    }

    return nextState.hands[player.id].map((card: any) => ({ ...card }));
  }

  function snapshotForUser(
    nextState: any,
    gameId: string | null,
    version: number | null,
    gameName: string | null,
    user: any
  ) {
    const baseSnapshot = snapshotForState(nextState, gameId, version, gameName);
    const resolvedPlayer = resolvePlayerForUser(nextState, user);

    return {
      ...baseSnapshot,
      playerId: resolvedPlayer ? resolvedPlayer.id : null,
      ...(resolvedPlayer
        ? {
            playerHand: visibleHandForPlayer(nextState, resolvedPlayer),
            assignedVictoryObjective: getAssignedVictoryObjectiveForPlayer(
              nextState,
              resolvedPlayer.id
            )
          }
        : {})
    };
  }

  async function healthSnapshot() {
    await initializeActiveGame();
    const storage = await datastore.healthSummary();
    return {
      ok: storage.ok,
      storage,
      activeGameId,
      activeGameVersion,
      hasActiveGame: Boolean(activeGameId)
    };
  }

  function ensureApiRequestContext(req: Request, res: Response, url: URL): { requestId: string } {
    const requestWithId = req as RequestWithId;
    const existingRequestId = requestWithId.__netriskRequestId;
    if (existingRequestId) {
      return {
        requestId: existingRequestId
      };
    }

    const requestId = crypto.randomUUID();
    requestWithId.__netriskRequestId = requestId;
    setResponseRequestContext(res, {
      requestId,
      method: String(req.method || "GET").toUpperCase(),
      path: url.pathname,
      release: runtimeRelease
    });

    return {
      requestId
    };
  }

  async function handleApi(req: Request, res: Response, url: URL) {
    ensureApiRequestContext(req, res, url);
    await initializeActiveGame();

    if (req.method === "GET" && url.pathname === "/api/health") {
      await handleHealthRoute(res, healthSnapshot, sendJson);
      return;
    }

    if (process.env.E2E === "true" && req.method === "POST" && url.pathname === "/api/test/reset") {
      if (typeof datastore.resetForTests === "function") {
        await datastore.resetForTests();
      }
      const resetGame = await gameSessions.createGame(createInitialState(), {
        name: "Partita test"
      });
      activeGameId = resetGame.game.id;
      activeGameVersion = resetGame.game.version;
      activeGameName = resetGame.game.name;
      replaceState(resetGame.state);
      nextAttackRolls = null;
      broadcastGame({
        gameId: resetGame.game.id,
        gameName: resetGame.game.name,
        version: resetGame.game.version,
        state: resetGame.state
      });
      sendJson(res, 200, { ok: true, state: snapshot() });
      return;
    }

    if (
      process.env.E2E === "true" &&
      req.method === "POST" &&
      url.pathname === "/api/test/next-attack-rolls"
    ) {
      const body = await parseBody(req);
      const attackRoll = Number(body.attackRoll);
      const defendRoll = Number(body.defendRoll);

      if (
        !Number.isInteger(attackRoll) ||
        attackRoll < 1 ||
        attackRoll > 6 ||
        !Number.isInteger(defendRoll) ||
        defendRoll < 1 ||
        defendRoll > 6
      ) {
        sendLocalizedError(
          res,
          400,
          null,
          "I lanci di test devono essere interi tra 1 e 6.",
          "server.test.invalidRolls"
        );
        return;
      }

      nextAttackRolls = [attackRoll, defendRoll];
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      await handleStateRoute(
        req,
        res,
        url,
        authorizeGameRead,
        getTargetGameId,
        loadGameContext,
        resumeAiTurnsForRead,
        auth.getUserFromSession,
        extractSessionToken,
        snapshotForUser,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/games") {
      await handleGamesListRoute(
        res,
        () => gameSessions.listGames(),
        getTargetGameId,
        sendJson,
        url,
        sendLocalizedError
      );
      return;
    }

    if (
      req.method === "GET" &&
      (url.pathname === "/api/game-options" || url.pathname === "/api/game/options")
    ) {
      const moduleOptions = await moduleRuntime.getModuleOptions();
      const adminDefaults = await getSafeAdminDefaults();
      await handleGameOptionsRoute(
        res,
        () => moduleOptions.resolvedCatalog || moduleOptions,
        listTurnTimeoutHoursOptions,
        sendJson,
        async () => ({
          ...(adminDefaults ? { adminDefaults } : {})
        }),
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/modules/options") {
      await handleModuleOptionsRoute(res, () => moduleRuntime.getModuleOptions(), sendJson);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/modules") {
      await handleListModulesRoute(
        req,
        res,
        requireAuth,
        authorize,
        () => moduleRuntime.listInstalledModules(),
        () => moduleRuntime.getEnabledModules(),
        sendJson,
        sendLocalizedError,
        NETRISK_ENGINE_VERSION
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/modules/rescan") {
      await handleRescanModulesRoute(
        req,
        res,
        requireAuth,
        authorize,
        () => moduleRuntime.rescan(),
        () => moduleRuntime.getEnabledModules(),
        sendJson,
        sendLocalizedError,
        NETRISK_ENGINE_VERSION
      );
      return;
    }

    const enableModuleMatch =
      req.method === "POST" ? url.pathname.match(/^\/api\/modules\/([^/]+)\/enable$/) : null;
    if (enableModuleMatch) {
      await handleEnableModuleRoute(
        req,
        res,
        decodeURIComponent(enableModuleMatch[1] || ""),
        requireAuth,
        authorize,
        (moduleId: string) => moduleRuntime.enableModule(moduleId),
        () => moduleRuntime.getEnabledModules(),
        sendJson,
        sendLocalizedError,
        NETRISK_ENGINE_VERSION
      );
      return;
    }

    const disableModuleMatch =
      req.method === "POST" ? url.pathname.match(/^\/api\/modules\/([^/]+)\/disable$/) : null;
    if (disableModuleMatch) {
      await handleDisableModuleRoute(
        req,
        res,
        decodeURIComponent(disableModuleMatch[1] || ""),
        requireAuth,
        authorize,
        async (moduleId: string) => {
          await adminConsole.assertModuleSafeToDisable(moduleId);
          return moduleRuntime.disableModule(moduleId);
        },
        () => moduleRuntime.getEnabledModules(),
        sendJson,
        sendLocalizedError,
        NETRISK_ENGINE_VERSION
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/overview") {
      await handleAdminOverviewRoute(
        req,
        res,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/users") {
      await handleAdminUsersRoute(
        req,
        res,
        url,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/users/role") {
      const body = await parseBody(req);
      await handleAdminUserRoleRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/games") {
      await handleAdminGamesRoute(
        req,
        res,
        url,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    const adminGameDetailMatch =
      req.method === "GET" ? url.pathname.match(/^\/api\/admin\/games\/([^/]+)$/) : null;
    if (adminGameDetailMatch) {
      await handleAdminGameDetailRoute(
        req,
        res,
        decodeURIComponent(adminGameDetailMatch[1] || ""),
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/games/action") {
      const body = await parseBody(req);
      await handleAdminGameActionRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/config") {
      await handleAdminConfigRoute(
        req,
        res,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/admin/config") {
      const body = await parseBody(req);
      await handleAdminConfigUpdateRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/maintenance") {
      await handleAdminMaintenanceRoute(
        req,
        res,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/maintenance") {
      const body = await parseBody(req);
      await handleAdminMaintenanceActionRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/audit") {
      await handleAdminAuditRoute(
        req,
        res,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/content-studio/options") {
      await handleAdminContentStudioOptionsRoute(
        req,
        res,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/content-studio/modules") {
      await handleAdminContentStudioModulesRoute(
        req,
        res,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/content-studio/modules/validate") {
      const body = await parseBody(req);
      await handleAdminContentStudioValidateRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/content-studio/modules") {
      const body = await parseBody(req);
      await handleAdminContentStudioCreateRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    const adminContentStudioDetailMatch = url.pathname.match(
      /^\/api\/admin\/content-studio\/modules\/([^/]+)$/
    );
    if (req.method === "GET" && adminContentStudioDetailMatch) {
      await handleAdminContentStudioModuleDetailRoute(
        req,
        res,
        decodeURIComponent(adminContentStudioDetailMatch[1] || ""),
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "PUT" && adminContentStudioDetailMatch) {
      const body = await parseBody(req);
      await handleAdminContentStudioUpdateRoute(
        req,
        res,
        decodeURIComponent(adminContentStudioDetailMatch[1] || ""),
        body,
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    const adminContentStudioPublishMatch = url.pathname.match(
      /^\/api\/admin\/content-studio\/modules\/([^/]+)\/publish$/
    );
    if (req.method === "POST" && adminContentStudioPublishMatch) {
      await handleAdminContentStudioPublishRoute(
        req,
        res,
        decodeURIComponent(adminContentStudioPublishMatch[1] || ""),
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    const adminContentStudioEnableMatch = url.pathname.match(
      /^\/api\/admin\/content-studio\/modules\/([^/]+)\/enable$/
    );
    if (req.method === "POST" && adminContentStudioEnableMatch) {
      await handleAdminContentStudioEnableRoute(
        req,
        res,
        decodeURIComponent(adminContentStudioEnableMatch[1] || ""),
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    const adminContentStudioDisableMatch = url.pathname.match(
      /^\/api\/admin\/content-studio\/modules\/([^/]+)\/disable$/
    );
    if (req.method === "POST" && adminContentStudioDisableMatch) {
      await handleAdminContentStudioDisableRoute(
        req,
        res,
        decodeURIComponent(adminContentStudioDisableMatch[1] || ""),
        requireAuth,
        authorize,
        adminConsole,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/cron/scheduled-jobs") {
      await handleScheduledJobsRoute(
        req,
        res,
        () =>
          runScheduledJobs({
            listGames: () => gameSessions.datastore.listGames(),
            saveGame: (
              gameId: string,
              nextState: Record<string, unknown>,
              expectedVersion?: number | null
            ) => gameSessions.saveGame(gameId, nextState, expectedVersion),
            forceEndTurn,
            recoverAiTurnState: (
              nextState: Record<string, unknown>,
              recoveryOptions?: { now?: Date }
            ) =>
              recoverAiTurnState(nextState, {
                ...recoveryOptions,
                forceEndTurn,
                runAiTurnsIfNeeded,
                logger: logAiRecovery
              }),
            afterSave: ({
              gameId,
              gameName,
              state: nextState,
              version
            }: {
              gameId: string;
              gameName: string;
              state: Record<string, unknown>;
              version: number | null;
            }) => {
              if (gameId === activeGameId) {
                activeGameVersion = version;
                activeGameName = gameName;
                if (nextState !== state) {
                  replaceState(nextState);
                }
              }

              broadcastGame({
                gameId,
                gameName,
                version,
                state: nextState
              });
            }
          }),
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games") {
      const body = await parseBody(req);
      const moduleOptions = await moduleRuntime.getModuleOptions();
      const resolvedCatalog = moduleOptions.resolvedCatalog || moduleOptions;
      const adminDefaults = await getSafeAdminDefaults();
      await handleCreateGameRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        (body: Record<string, unknown>) =>
          createConfiguredInitialState(body, {
            defaultConfigInput: deepClone(adminDefaults || {}),
            resolveRuleSet: (ruleSetId: string) =>
              resolvedCatalog.ruleSets.find((entry: { id: string }) => entry.id === ruleSetId) ||
              null,
            resolveContentPack: (contentPackId: string) =>
              moduleRuntime.findContentPack(contentPackId),
            resolveDiceRuleSet: (diceRuleSetId: string) =>
              moduleRuntime.findDiceRuleSet(diceRuleSetId),
            resolvePlayerPieceSet: (pieceSetId: string) =>
              moduleRuntime.findPlayerPieceSet(pieceSetId),
            resolveSupportedMap: (mapId: string) => moduleRuntime.findSupportedMap(mapId),
            resolveVictoryRuleSet: (victoryRuleSetId: string) =>
              resolvedCatalog.victoryRuleSets.find(
                (entry: { id: string }) => entry.id === victoryRuleSetId
              ) || null,
            resolveVictoryRuleRuntime: (victoryRuleSetId: string) =>
              moduleRuntime.findVictoryRuleSetRuntime(victoryRuleSetId),
            resolveTheme: (themeId: string) =>
              resolvedCatalog.themes.find((entry: { id: string }) => entry.id === themeId) || null,
            resolvePieceSkin: (pieceSkinId: string) =>
              resolvedCatalog.pieceSkins.find(
                (entry: { id: string }) => entry.id === pieceSkinId
              ) || null,
            resolveGamePreset: (input: {
              gamePresetId?: string | null;
              activeModuleIds?: string[];
            }) => moduleRuntime.resolveGamePreset(input),
            resolveGameModuleConfigDefaults: (input: {
              activeModuleIds?: string[];
              contentProfileId?: string | null;
              gameplayProfileId?: string | null;
              uiProfileId?: string | null;
            }) => moduleRuntime.resolveGameConfigDefaults(input),
            resolveGameModuleSelection: (input: {
              activeModuleIds?: string[];
              contentProfileId?: string | null;
              gameplayProfileId?: string | null;
              uiProfileId?: string | null;
              contentPackId?: string | null;
              pieceSetId?: string | null;
              mapId?: string | null;
              diceRuleSetId?: string | null;
              victoryRuleSetId?: string | null;
              themeId?: string | null;
              pieceSkinId?: string | null;
            }) => moduleRuntime.resolveGameSelection(input)
          }),
        addPlayer,
        async (state: any, options: Record<string, any>) => {
          const created = await gameSessions.createGame(state, options);
          activeGameId = created.game.id;
          activeGameVersion = created.game.version;
          activeGameName = created.game.name;
          return created;
        },
        () => gameSessions.listGames(),
        replaceState,
        broadcastGame,
        snapshot,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games/open") {
      const body = await parseBody(req);
      await handleOpenGameRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        (gameId: string) => gameSessions.getGame(gameId),
        (gameId: string) => gameSessions.openGame(gameId),
        () => gameSessions.listGames(),
        resumeAiTurnsForRead,
        resolvePlayerForUser,
        snapshotForState,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/session") {
      await handleAuthSessionRoute({
        req,
        res,
        requireAuth,
        auth,
        playerProfiles,
        sendJson,
        sendLocalizedError,
        extractUserPreferences,
        supportedSiteThemes,
        resolveStoredTheme
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      await handleProfileRoute({
        req,
        res,
        requireAuth,
        auth,
        playerProfiles,
        sendJson,
        sendLocalizedError,
        extractUserPreferences,
        supportedSiteThemes,
        resolveStoredTheme
      });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/profile/preferences/theme") {
      const body = await parseBody(req);
      await handleThemePreferenceRoute(
        {
          req,
          res,
          requireAuth,
          auth,
          playerProfiles,
          sendJson,
          sendLocalizedError,
          extractUserPreferences,
          supportedSiteThemes,
          resolveStoredTheme
        },
        body
      );
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/profile/account") {
      const body = await parseBody(req);
      await handleAccountSettingsRoute(
        {
          req,
          res,
          requireAuth,
          auth,
          playerProfiles,
          sendJson,
          sendLocalizedError,
          extractUserPreferences,
          supportedSiteThemes,
          resolveStoredTheme
        },
        body
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      await handleEventsRoute(
        req,
        res,
        url,
        authorizeGameRead,
        getTargetGameId,
        loadGameContext,
        resumeAiTurnsForRead,
        snapshotForUser,
        clientsByGameId,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await parseBody(req);
      await handleRegisterRoute(req, res, body, auth, sendJson, sendLocalizedError);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await parseBody(req);
      await handleLoginRoute(
        req,
        res,
        body,
        auth,
        sendJson,
        sendLocalizedError,
        buildSessionCookie
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const body = await parseBody(req);
      await handleLogoutRoute(
        req,
        res,
        body,
        auth,
        sendJson,
        extractSessionToken,
        clearSessionCookie
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/join") {
      const body = await parseBody(req);
      await handleAiJoinRoute(
        res,
        body,
        url,
        loadGameContext,
        getTargetGameId,
        addPlayer,
        persistGameContext,
        broadcastGame,
        snapshotForState,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/join") {
      const body = await parseBody(req);
      await handleJoinRoute(
        req,
        res,
        body,
        url,
        requireAuth,
        loadGameContext,
        getTargetGameId,
        addPlayer,
        persistGameContext,
        broadcastGame,
        snapshotForState,
        auth.publicUser,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cards/trade") {
      const body = await parseBody(req);
      await handleCardsTradeRoute(
        req,
        res,
        body,
        url,
        requireAuth,
        loadGameContext,
        getTargetGameId,
        getPlayer,
        playerBelongsToUser,
        tradeCardSet,
        persistGameContext,
        broadcastGame,
        snapshotForUser,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/start") {
      const body = await parseBody(req);
      await handleStartRoute(
        req,
        res,
        body,
        url,
        requireAuth,
        loadGameContext,
        getTargetGameId,
        gameSessions.getGame,
        authorize,
        getPlayer,
        playerBelongsToUser,
        startGame,
        persistWithAiTurns,
        broadcastGame,
        snapshotForUser,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/action") {
      const body = await parseBody(req);
      function consumeQueuedAttackRandom() {
        if (
          process.env.E2E !== "true" ||
          !Array.isArray(nextAttackRolls) ||
          nextAttackRolls.length !== 2
        ) {
          return null;
        }

        const queuedRolls = nextAttackRolls.slice();
        nextAttackRolls = null;
        return () => {
          const roll = queuedRolls.shift();
          if (!roll) {
            return secureRandom();
          }

          return (roll - 0.01) / 6;
        };
      }

      await handleGameActionRoute({
        req,
        res,
        body,
        url,
        requireAuth,
        loadGameContext,
        getTargetGameId,
        playerBelongsToUser,
        persistGameContext,
        persistWithAiTurns,
        broadcastGame,
        snapshotForUser,
        consumeQueuedAttackRandom,
        localizedPayload,
        sendJson,
        sendLocalizedError
      });
      return;
    }

    sendLocalizedError(res, 404, null, "Endpoint non trovato.", "server.endpoint.notFound");
  }

  function serveStatic(res: Response, url: URL) {
    const isModuleAssetRequest = url.pathname.indexOf("/modules/") === 0;
    const staticRoot = isModuleAssetRequest ? runtimeModulesDir : runtimePublicDir;
    const isReactShellDocumentRoute =
      !isModuleAssetRequest &&
      (url.pathname === "/" ||
        url.pathname === "/login" ||
        url.pathname === "/register" ||
        url.pathname === "/lobby" ||
        url.pathname === "/lobby/new" ||
        url.pathname === "/admin" ||
        url.pathname.indexOf("/admin/") === 0 ||
        url.pathname === "/profile" ||
        url.pathname === "/unauthorized" ||
        url.pathname === "/game.html" ||
        url.pathname === "/game" ||
        url.pathname === "/react" ||
        url.pathname === "/react/" ||
        (url.pathname.indexOf("/react/") === 0 && path.extname(url.pathname) === "") ||
        /^\/game\/[^/]+$/.test(url.pathname));
    const relativePath = isModuleAssetRequest
      ? url.pathname.replace(/^\/modules\//, "")
      : isReactShellDocumentRoute
        ? "/react/index.html"
        : url.pathname;
    const resolvedStaticRoot = path.resolve(staticRoot);
    const filePath = path.resolve(path.join(staticRoot, relativePath));
    if (filePath !== resolvedStaticRoot && !filePath.startsWith(resolvedStaticRoot + path.sep)) {
      sendLocalizedError(res, 403, null, "Accesso negato.", "server.static.accessDenied");
      return;
    }

    fs.readFile(filePath, (error: NodeJS.ErrnoException | null, data: Buffer) => {
      if (error) {
        sendLocalizedError(res, 404, null, "File non trovato.", "server.static.fileNotFound");
        return;
      }

      const extension = path.extname(filePath);
      const contentTypes = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".woff2": "font/woff2"
      };

      const contentType =
        contentTypes[extension as keyof typeof contentTypes] || "text/plain; charset=utf-8";
      res.writeHead(200, {
        "Content-Type": contentType
      });
      res.end(data);
    });
  }

  function addSecurityHeaders(res: Response) {
    const connectSources = ["'self'"];
    if (sentryConnectOrigin) {
      connectSources.push(sentryConnectOrigin);
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectSources.join(" ")}`
    );
  }

  function handleRequest(req: Request, res: Response) {
    const url = new URL(req.url || "/", "http://" + req.headers.host);

    addSecurityHeaders(res);

    Promise.resolve()
      .then(() => {
        if (url.pathname.indexOf("/api/") === 0) {
          return handleApi(req, res, url);
        }

        if (req.method === "GET" && url.pathname === "/landing.html") {
          res.writeHead(302, {
            Location: "/"
          });
          res.end();
          return null;
        }

        if (req.method === "GET" && url.pathname === "/index.html") {
          res.writeHead(302, {
            Location: "/"
          });
          res.end();
          return null;
        }

        if (req.method === "GET" && url.pathname === "/register.html") {
          res.writeHead(302, {
            Location: "/register" + url.search
          });
          res.end();
          return null;
        }

        if (req.method === "GET" && url.pathname === "/lobby.html") {
          res.writeHead(302, {
            Location: "/lobby" + url.search
          });
          res.end();
          return null;
        }

        if (req.method === "GET" && url.pathname === "/new-game.html") {
          res.writeHead(302, {
            Location: "/lobby/new" + url.search
          });
          res.end();
          return null;
        }

        if (req.method === "GET" && url.pathname === "/profile.html") {
          res.writeHead(302, {
            Location: "/profile" + url.search
          });
          res.end();
          return null;
        }

        if (req.method === "GET" && url.pathname === "/game.html") {
          const requestedGameId = url.searchParams.get("gameId");
          if (requestedGameId) {
            res.writeHead(302, {
              Location: "/game/" + encodeURIComponent(requestedGameId)
            });
            res.end();
            return null;
          }
        }

        if (req.method === "GET" && (url.pathname === "/legacy" || url.pathname === "/legacy/")) {
          res.writeHead(302, {
            Location: "/legacy/index.html"
          });
          res.end();
          return null;
        }

        serveStatic(res, url);
        return null;
      })
      .catch((error: any) => {
        sendLocalizedError(res, 500, error, "Errore interno.", "server.internalError");
      });
  }

  const server = http.createServer(handleRequest);

  return {
    adminConsole,
    auth,
    authoredModules,
    datastore,
    handleApi,
    handleRequest,
    moduleRuntime,
    parseBody,
    sendJson,
    server,
    state
  };
}

const app = createApp();

if (require.main === module) {
  app.server.listen(port, () => {
    console.log("Server attivo su http://localhost:" + port);
  });
}

module.exports = {
  createApp,
  parseBody,
  sendJson,
  auth: app.auth,
  datastore: app.datastore,
  handleApi: app.handleApi,
  handleRequest: app.handleRequest,
  server: app.server,
  state: app.state
};
