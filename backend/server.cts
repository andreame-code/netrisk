// @ts-nocheck
const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadLocalEnv } = require("./load-local-env.cjs");
const { createDatastore } = require("./datastore.cjs");
const { createAuthStore } = require("./auth.cjs");
const { authorize } = require("./authorization.cjs");
const { createGameSessionStore } = require("./game-session-store.cjs");
const { createPlayerProfileStore } = require("./player-profile-store.cjs");
const { createConfiguredInitialState, listDiceRuleSets, listNewGameRuleSets, listSupportedMaps } = require("./new-game-config.cjs");
const { secureRandom } = require("./random.cjs");
const { isPromiseLike } = require("./maybe-async.cjs");
const { missingRequiredDeployEnv, shouldValidateDeployEnv } = require("./required-runtime-env.cjs");
const {
  addPlayer,
  createInitialState,
  getCurrentPlayer,
  getPlayer,
  publicState,
  startGame,
  tradeCardSet
} = require("./engine/game-engine.cjs");
const { runAiTurn } = require("./engine/ai-player.cjs");
const { createLocalizedError } = require("../shared/messages.cjs");
const { sendJson, sendLocalizedError, localizedPayload } = require("./http-response.cjs");
const { handleAuthSessionRoute, handleProfileRoute, handleThemePreferenceRoute } = require("./routes/account.cjs");
const { handleGameActionRoute } = require("./routes/game-actions.cjs");
const { handleCardsTradeRoute } = require("./routes/game-cards.cjs");
const { handleCreateGameRoute, handleOpenGameRoute } = require("./routes/game-management.cjs");
const { handleGamesListRoute, handleGameOptionsRoute } = require("./routes/game-overview.cjs");
const { handleEventsRoute, handleStateRoute } = require("./routes/game-read.cjs");
const { handleAiJoinRoute, handleJoinRoute, handleStartRoute } = require("./routes/game-setup.cjs");
const { handleHealthRoute } = require("./routes/health.cjs");
const { handleLoginRoute, handleLogoutRoute, handleRegisterRoute } = require("./routes/password-auth.cjs");

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

    const frontendPath = path.join(absolute, "frontend", "public");
    const dataPath = path.join(absolute, "data");

    if (fs.existsSync(frontendPath) && fs.existsSync(dataPath)) {
      return absolute;
    }
  }

  return path.resolve(process.cwd());
}

const projectRoot = resolveProjectRoot();
const publicDir = path.join(projectRoot, "frontend", "public");
const port = process.env.PORT || 3000;
const sessionCookieName = "netrisk_session";
const supportedSiteThemes = new Set(["command", "midnight", "ember"]);

function resolveStoredTheme(theme) {
  return supportedSiteThemes.has(theme) ? theme : "command";
}

function extractUserPreferences(user) {
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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
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
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(createLocalizedError("JSON non valido", "server.invalidJson"));
      }
    });
  });
}

function parseCookies(req) {
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
  }, {});
}

function secureCookieFlag(req) {
  return req.socket?.encrypted || req.headers["x-forwarded-proto"] === "https";
}

function buildSessionCookie(req, sessionToken) {
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

function clearSessionCookie(req) {
  const parts = [
    `${sessionCookieName}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0"
  ];
  if (secureCookieFlag(req)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function createApp(options = {}) {
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
  let activeGameId = null;
  let activeGameVersion = null;
  let activeGameName = null;
  let nextAttackRolls = null;
  const datastore = createDatastore({
    dbFile: options.dbFile || defaultDbFile(),
    legacyUsersFile: options.dataFile || path.join(projectRoot, "data", "users.json"),
    legacyGamesFile: options.gamesFile || path.join(projectRoot, "data", "games.json"),
    legacySessionsFile: options.sessionsFile || path.join(projectRoot, "data", "sessions.json")
  });
  const gamesFile = options.gamesFile || path.join(projectRoot, "data", "games.json");
  const gameSessions = createGameSessionStore({
    datastore,
    dataFile: gamesFile
  });
  const playerProfiles = createPlayerProfileStore({
    datastore,
    gamesFile
  });
  const auth = createAuthStore({
    datastore,
    dataFile: options.dataFile || path.join(projectRoot, "data", "users.json"),
    sessionsFile: options.sessionsFile || path.join(projectRoot, "data", "sessions.json")
  });
  const clientsByGameId = new Map();
  let initPromise = null;

  const eagerInitialGame = gameSessions.ensureActiveGame(createInitialState);
  if (isPromiseLike(eagerInitialGame)) {
    initPromise = eagerInitialGame
      .then((initialGame) => {
        activeGameId = initialGame.game.id;
        activeGameVersion = initialGame.game.version;
        activeGameName = initialGame.game.name;
        replaceState(initialGame.state);
      })
      .finally(() => {
        initPromise = null;
      });
  } else {
    activeGameId = eagerInitialGame.game.id;
    activeGameVersion = eagerInitialGame.game.version;
    activeGameName = eagerInitialGame.game.name;
    replaceState(eagerInitialGame.state);
  }

  function replaceState(nextState) {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, nextState);
  }

  async function initializeActiveGame() {
    if (activeGameId) {
      return;
    }

    if (!initPromise) {
      initPromise = Promise.resolve(gameSessions.ensureActiveGame(createInitialState))
        .then((initialGame) => {
          activeGameId = initialGame.game.id;
          activeGameVersion = initialGame.game.version;
          activeGameName = initialGame.game.name;
          replaceState(initialGame.state);
        })
        .finally(() => {
          initPromise = null;
        });
    }

    await initPromise;
  }

  async function persistActiveGame(expectedVersion) {
    if (!activeGameId) {
      return null;
    }

    const savedGame = await gameSessions.saveGame(activeGameId, state, expectedVersion);
    activeGameVersion = savedGame.version;
    activeGameName = savedGame.name;
    return savedGame;
  }

  function snapshotForState(nextState, gameId, version, gameName) {
    return { ...publicState(nextState), gameId, version, gameName };
  }

  function snapshot() {
    return snapshotForState(state, activeGameId, activeGameVersion, activeGameName);
  }

  function getTargetGameId(body = {}, url = null) {
    return body.gameId || (url ? url.searchParams.get("gameId") : null) || activeGameId || null;
  }

  async function loadGameContext(gameId) {
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

  async function persistGameContext(gameContext, expectedVersion) {
    if (!gameContext?.gameId) {
      return null;
    }

    const savedGame = await gameSessions.saveGame(gameContext.gameId, gameContext.state, expectedVersion);
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

  function broadcastGame(gameContext) {
    if (!gameContext?.gameId) {
      return;
    }

    const clients = clientsByGameId.get(gameContext.gameId);
    if (!clients || !clients.size) {
      return;
    }

    clients.forEach((client) => {
      const payload = "data: " + JSON.stringify(
        snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, client.user)
      ) + "\n\n";
      client.res.write(payload);
    });
  }

  function runAiTurnsIfNeeded(targetState) {
    const reports = [];
    const maxTurns = Math.max(4, targetState.players.length * 4);

    for (let step = 0; step < maxTurns; step += 1) {
      const currentPlayer = getCurrentPlayer(targetState);
      if (!currentPlayer || !currentPlayer.isAi || targetState.phase !== "active" || targetState.winnerId) {
        break;
      }

      const result = runAiTurn(targetState);
      if (!result.ok) {
        throw createLocalizedError(result.error || "Turno AI non riuscito.", result.errorKey || "server.aiTurn.failed", result.errorParams);
      }

      reports.push(result);
    }

    return reports;
  }

  async function persistWithAiTurns(gameContext, expectedVersion) {
    await persistGameContext(gameContext, expectedVersion);
    const aiReports = runAiTurnsIfNeeded(gameContext.state);
    if (aiReports.length > 0) {
      await persistGameContext(gameContext, gameContext.version);
    }
    return aiReports;
  }

  async function resumeAiTurnsForRead(gameContext) {
    if (!gameContext?.state || gameContext.state.phase !== "active" || gameContext.state.winnerId) {
      return [];
    }

    const currentPlayer = getCurrentPlayer(gameContext.state);
    if (!currentPlayer || !currentPlayer.isAi) {
      return [];
    }

    return persistWithAiTurns(gameContext, gameContext.version);
  }

  function extractSessionToken(req, body = {}, url = null) {
    const cookies = parseCookies(req);
    return cookies[sessionCookieName] || null;
  }

  async function requireAuth(req, res, body, url = null) {
    const sessionToken = extractSessionToken(req, body, url);
    const user = await auth.getUserFromSession(sessionToken);
    if (!user) {
      sendLocalizedError(res, 401, null, "Sessione non valida.", "server.auth.invalidSession", {}, "AUTH_REQUIRED");
      return null;
    }

    return { sessionToken, user };
  }

  async function authorizeGameRead(gameId, req, res, url) {
    if (!gameId) {
      return { ok: true, user: null, gameRecord: null };
    }

    let gameRecord = null;
    try {
      gameRecord = await gameSessions.getGame(gameId);
    } catch (error) {
      sendLocalizedError(res, 404, error, "Partita non trovata.", "server.game.notFound", {}, "GAME_NOT_FOUND");
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
      authorize("game:read", { user: authContext.user, game: gameRecord.game, state: gameRecord.state });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      sendLocalizedError(res, statusCode, error, "Accesso partita non autorizzato.", "server.game.readUnauthorized");
      return null;
    }

    return { ...authContext, gameRecord };
  }

  function resolvePlayerForUser(nextState, user) {
    if (!user || !nextState || !Array.isArray(nextState.players)) {
      return null;
    }

    return nextState.players.find((player) => {
      if (player.isAi) {
        return false;
      }

      if (player.linkedUserId) {
        return player.linkedUserId === user.id;
      }

      return player.name === user.username;
    }) || null;
  }

  function playerBelongsToUser(player, user) {
    if (!player || !user || player.isAi) {
      return false;
    }

    if (!player.linkedUserId) {
      return false;
    }

    return player.linkedUserId === user.id;
  }

  function visibleHandForPlayer(nextState, player) {
    if (!player || !Array.isArray(nextState?.hands?.[player.id])) {
      return [];
    }

    return nextState.hands[player.id].map((card) => ({ ...card }));
  }

  function snapshotForUser(nextState, gameId, version, gameName, user) {
    const baseSnapshot = snapshotForState(nextState, gameId, version, gameName);
    const resolvedPlayer = resolvePlayerForUser(nextState, user);

    return {
      ...baseSnapshot,
      playerId: resolvedPlayer ? resolvedPlayer.id : null,
      ...(resolvedPlayer ? { playerHand: visibleHandForPlayer(nextState, resolvedPlayer) } : {})
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

  async function handleApi(req, res, url) {
    await initializeActiveGame();

    if (req.method === "GET" && url.pathname === "/api/health") {
      await handleHealthRoute(res, healthSnapshot, sendJson);
      return;
    }

    if (process.env.E2E === "true" && req.method === "POST" && url.pathname === "/api/test/reset") {
      if (typeof datastore.resetForTests === "function") {
        await datastore.resetForTests();
      }
      const resetGame = await gameSessions.createGame(createInitialState(), { name: "Partita test" });
      activeGameId = resetGame.game.id;
      activeGameVersion = resetGame.game.version;
      activeGameName = resetGame.game.name;
      replaceState(resetGame.state);
      nextAttackRolls = null;
      broadcastGame({ gameId: resetGame.game.id, gameName: resetGame.game.name, version: resetGame.game.version, state: resetGame.state });
      sendJson(res, 200, { ok: true, state: snapshot() });
      return;
    }

    if (process.env.E2E === "true" && req.method === "POST" && url.pathname === "/api/test/next-attack-rolls") {
      const body = await parseBody(req);
      const attackRoll = Number(body.attackRoll);
      const defendRoll = Number(body.defendRoll);

      if (!Number.isInteger(attackRoll) || attackRoll < 1 || attackRoll > 6 || !Number.isInteger(defendRoll) || defendRoll < 1 || defendRoll > 6) {
        sendLocalizedError(res, 400, null, "I lanci di test devono essere interi tra 1 e 6.", "server.test.invalidRolls");
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
        sendJson
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/games") {
      await handleGamesListRoute(res, () => gameSessions.listGames(), getTargetGameId, sendJson, url);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/game-options") {
      handleGameOptionsRoute(res, listNewGameRuleSets, listSupportedMaps, listDiceRuleSets, sendJson);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games") {
      const body = await parseBody(req);
      await handleCreateGameRoute(
        req,
        res,
        body,
        requireAuth,
        authorize,
        createConfiguredInitialState,
        addPlayer,
        async (state, options) => {
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
        (gameId) => gameSessions.getGame(gameId),
        (gameId) => gameSessions.openGame(gameId),
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
      await handleThemePreferenceRoute({
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
      }, body);
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
        clientsByGameId
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
      await handleLoginRoute(req, res, body, auth, sendJson, sendLocalizedError, buildSessionCookie);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const body = await parseBody(req);
      await handleLogoutRoute(req, res, body, auth, sendJson, extractSessionToken, clearSessionCookie);
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
        snapshotForState,
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
        snapshotForState,
        sendJson,
        sendLocalizedError
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/action") {
      const body = await parseBody(req);
      function consumeQueuedAttackRandom() {
        if (process.env.E2E !== "true" || !Array.isArray(nextAttackRolls) || nextAttackRolls.length !== 2) {
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

  function serveStatic(res, url) {
    const relativePath = url.pathname === "/"
      ? "/index.html"
      : url.pathname.indexOf("/game/") === 0
        ? "/game.html"
        : url.pathname;
    const resolvedPublicDir = path.resolve(publicDir);
    const filePath = path.resolve(path.join(publicDir, relativePath));
    if (filePath !== resolvedPublicDir && !filePath.startsWith(resolvedPublicDir + path.sep)) {
      sendLocalizedError(res, 403, null, "Accesso negato.", "server.static.accessDenied");
      return;
    }

    fs.readFile(filePath, (error, data) => {
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
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".webp": "image/webp"
      };

      res.writeHead(200, {
        "Content-Type": contentTypes[extension] || "text/plain; charset=utf-8"
      });
      res.end(data);
    });
  }

  function addSecurityHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  }

  function handleRequest(req, res) {
    const url = new URL(req.url, "http://" + req.headers.host);

    addSecurityHeaders(res);

    Promise.resolve()
      .then(() => {
        if (url.pathname.indexOf("/api/") === 0) {
          return handleApi(req, res, url);
        }

        serveStatic(res, url);
        return null;
      })
      .catch((error) => {
        sendLocalizedError(res, 500, error, "Errore interno.", "server.internalError");
      });
  }

  const server = http.createServer(handleRequest);

  return {
    auth,
    datastore,
    handleApi,
    handleRequest,
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
