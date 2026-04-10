const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadLocalEnv } = require("./load-local-env.cjs");
const { createDatastore } = require("./datastore.cjs");
const { createAuthStore } = require("./auth.cjs");
const { authorize } = require("./authorization.cjs");
const { createGameSessionStore } = require("./game-session-store.cjs");
const { createPlayerProfileStore } = require("./player-profile-store.cjs");
const { createConfiguredInitialState, listDiceRuleSets, listSupportedMaps } = require("./new-game-config.cjs");
const { secureRandom } = require("./random.cjs");
const { isPromiseLike } = require("./maybe-async.cjs");
const { missingRequiredDeployEnv, shouldValidateDeployEnv } = require("./required-runtime-env.cjs");
const {
  addPlayer,
  applyFortify,
  applyReinforcement,
  createInitialState,
  endTurn,
  getCurrentPlayer,
  getPlayer,
  moveAfterConquest,
  publicState,
  resolveAttack,
  startGame,
  surrenderPlayer,
  tradeCardSet
} = require("./engine/game-engine.cjs");
const { resolveBanzaiAttack } = require("./engine/banzai-attack.cjs");
const { runAiTurn } = require("./engine/ai-player.cjs");
const { createLocalizedError } = require("../shared/messages.cjs");

loadLocalEnv();

const publicDir = path.join(__dirname, "..", "frontend", "public");
const port = process.env.PORT || 3000;
const sessionCookieName = "netrisk_session";

function defaultDbFile() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "netrisk.sqlite");
  }

  return path.join(__dirname, "..", "data", "netrisk.sqlite");
}

function sendJson(res, statusCode, payload, headers = {}) {
  if (res.headersSent || res.writableEnded) {
    return;
  }

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(payload));
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

function localizedPayload(input, fallbackMessage, fallbackKey, fallbackParams = {}, code = null) {
  const isObject = input && typeof input === "object";
  const message = isObject
    ? (input.message || input.error || input.reason || input.defaultMessage || fallbackMessage)
    : fallbackMessage;
  const messageKey = isObject
    ? (input.messageKey || input.errorKey || input.reasonKey || null)
    : null;
  const messageParams = isObject
    ? (input.messageParams || input.errorParams || input.reasonParams || {})
    : {};

  return {
    error: message || fallbackMessage,
    messageKey: messageKey || fallbackKey || null,
    messageParams: messageKey ? messageParams : (fallbackKey ? fallbackParams : {})
  };
}

function sendLocalizedError(res, statusCode, input, fallbackMessage, fallbackKey, fallbackParams = {}, code = null, extra = {}) {
  const payload = localizedPayload(input, fallbackMessage, fallbackKey, fallbackParams, code);
  sendJson(res, statusCode, {
    ...payload,
    code: code || (input && input.code) || null,
    ...extra
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
    legacyUsersFile: options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    legacyGamesFile: options.gamesFile || path.join(__dirname, "..", "data", "games.json"),
    legacySessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
  });
  const gamesFile = options.gamesFile || path.join(__dirname, "..", "data", "games.json");
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
    dataFile: options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    sessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
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

    if (player.linkedUserId) {
      return player.linkedUserId === user.id;
    }

    return player.name === user.username;
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
      const health = await healthSnapshot();
      sendJson(res, health.ok ? 200 : 503, health);
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
      const gameId = getTargetGameId({}, url);
      const access = await authorizeGameRead(gameId, req, res, url);
      if (access === null) {
        return;
      }
      const gameContext = await loadGameContext(gameId);
      await resumeAiTurnsForRead(gameContext);
      const sessionUser = access && access.user ? access.user : await auth.getUserFromSession(extractSessionToken(req, {}, url));
      sendJson(res, 200, snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, sessionUser));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/games") {
      sendJson(res, 200, { games: await gameSessions.listGames(), activeGameId: getTargetGameId({}, url) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/game-options") {
      sendJson(res, 200, { maps: listSupportedMaps(), diceRuleSets: listDiceRuleSets(), playerRange: { min: 2, max: 4 } });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games") {
      const body = await parseBody(req);
      const authContext = await requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      try {
        const policy = authorize("game:create", { user: authContext.user });
        const configured = createConfiguredInitialState(body);
        const creatorJoin = addPlayer(configured.state, authContext.user.username, { linkedUserId: policy.actor.id });
        if (!creatorJoin.ok) {
          throw createLocalizedError(creatorJoin.error || "Impossibile collegare il creatore alla nuova partita.", creatorJoin.errorKey || "server.game.create.creatorJoinFailed", creatorJoin.errorParams);
        }
        const created = await gameSessions.createGame(configured.state, {
          ...configured.gameInput,
          creatorUserId: policy.actor.id
        });
        activeGameId = created.game.id;
        activeGameVersion = created.game.version;
        activeGameName = created.game.name;
        replaceState(created.state);
        broadcastGame({ gameId: created.game.id, gameName: created.game.name, version: created.game.version, state: created.state });
        sendJson(res, 201, { ok: true, game: created.game, games: await gameSessions.listGames(), activeGameId, state: snapshot(), config: configured.config, playerId: creatorJoin.player.id });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        sendLocalizedError(res, statusCode, error, "Creazione partita non riuscita.", "server.game.createFailed");
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games/open") {
      const body = await parseBody(req);
      const authContext = await requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      try {
        const gameRecord = await gameSessions.getGame(body.gameId);
        authorize("game:open", { user: authContext.user, game: gameRecord.game, state: gameRecord.state });
        const opened = await gameSessions.openGame(body.gameId);
        await resumeAiTurnsForRead(opened);
        const resolvedPlayer = resolvePlayerForUser(opened.state, authContext.user);
        sendJson(res, 200, {
          ok: true,
          game: opened.game,
          games: await gameSessions.listGames(),
          activeGameId: opened.game.id,
          state: snapshotForState(opened.state, opened.game.id, opened.game.version, opened.game.name),
          playerId: resolvedPlayer ? resolvedPlayer.id : null
        });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        sendLocalizedError(res, statusCode, error, "Apertura partita non riuscita.", "server.game.openFailed");
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/session") {
      const authContext = await requireAuth(req, res, {});
      if (!authContext) {
        return;
      }

      sendJson(res, 200, { user: auth.publicUser(authContext.user) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const authContext = await requireAuth(req, res, {});
      if (!authContext) {
        return;
      }

      try {
        sendJson(res, 200, { profile: await playerProfiles.getPlayerProfile(authContext.user.username) });
      } catch (error) {
        sendLocalizedError(res, 400, error, "Profilo non disponibile.", "server.profile.unavailable");
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      const gameId = getTargetGameId({}, url);
      const access = await authorizeGameRead(gameId, req, res, url);
      if (access === null) {
        return;
      }
      const gameContext = await loadGameContext(gameId);
      await resumeAiTurnsForRead(gameContext);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      res.write("data: " + JSON.stringify(snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, access.user || null)) + "\n\n");
      const key = gameContext.gameId || "__default__";
      if (!clientsByGameId.has(key)) {
        clientsByGameId.set(key, new Set());
      }
      const client = { res, user: access.user || null };
      clientsByGameId.get(key).add(client);
      req.on("close", () => {
        const group = clientsByGameId.get(key);
        if (!group) {
          return;
        }
        group.delete(client);
        if (!group.size) {
          clientsByGameId.delete(key);
        }
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await parseBody(req);
      const result = await auth.registerPasswordUser({
        username: body.username,
        password: body.password,
        email: body.email
      });
      if (!result.ok) {
        sendLocalizedError(res, 400, result, result.error, result.errorKey || "register.errors.submitFailed", result.errorParams);
        return;
      }

      sendJson(res, 201, {
        ok: true,
        user: result.user,
        nextAuthProviders: ["password", "email", "google", "discord"]
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await parseBody(req);
      const result = await auth.loginWithPassword(body.username, body.password);
      if (!result.ok) {
        sendLocalizedError(res, 401, result, result.error, result.errorKey || "errors.loginFailed", result.errorParams);
        return;
      }

      sendJson(res, 200, {
        ok: true,
        user: result.user,
        availableAuthProviders: ["password", "email", "google", "discord"]
      }, {
        "Set-Cookie": buildSessionCookie(req, result.sessionToken)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const body = await parseBody(req);
      await auth.logout(extractSessionToken(req, body));
      sendJson(res, 200, { ok: true }, {
        "Set-Cookie": clearSessionCookie(req)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/join") {
      const body = await parseBody(req);
      const gameContext = await loadGameContext(getTargetGameId(body, url));
      const result = addPlayer(gameContext.state, body.name, { isAi: true });
      if (!result.ok) {
        sendLocalizedError(res, 400, result, result.error, result.errorKey || "server.aiJoin.failed", result.errorParams);
        return;
      }

      await persistGameContext(gameContext);
      broadcastGame(gameContext);
      sendJson(res, result.rejoined ? 200 : 201, {
        playerId: result.player.id,
        state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName),
        player: result.player
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/join") {
      const body = await parseBody(req);
      const authContext = await requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const gameContext = await loadGameContext(getTargetGameId(body, url));
      const result = addPlayer(gameContext.state, authContext.user.username, { linkedUserId: authContext.user.id });
      if (!result.ok) {
        sendLocalizedError(res, 400, result, result.error, result.errorKey || "server.join.failed", result.errorParams);
        return;
      }

      await persistGameContext(gameContext);
      broadcastGame(gameContext);
      sendJson(res, result.rejoined ? 200 : 201, {
        playerId: result.player.id,
        state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName),
        user: auth.publicUser(authContext.user)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cards/trade") {
      const body = await parseBody(req);
      const authContext = await requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const gameContext = await loadGameContext(getTargetGameId(body, url));
      const player = getPlayer(gameContext.state, body.playerId);
      if (!player || !playerBelongsToUser(player, authContext.user)) {
        sendLocalizedError(res, 403, null, "Giocatore non valido.", "game.invalidPlayer");
        return;
      }

      const expectedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion);
      if (body.expectedVersion != null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
        sendLocalizedError(res, 400, null, "expectedVersion non valida.", "server.invalidExpectedVersion");
        return;
      }

      if (expectedVersion != null && expectedVersion !== gameContext.version) {
        sendLocalizedError(res, 409, null, "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.", "server.versionConflict", {}, "VERSION_CONFLICT", {
          currentVersion: gameContext.version,
          state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName)
        });
        return;
      }

      const result = tradeCardSet(gameContext.state, body.playerId, body.cardIds);
      if (!result.ok) {
        sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
        return;
      }

      try {
        await persistGameContext(gameContext, expectedVersion);
      } catch (error) {
        if (error && error.code === "VERSION_CONFLICT") {
          sendLocalizedError(res, 409, error, error.message, error.messageKey || "server.versionConflict", {}, error.code, {
            currentVersion: error.currentVersion,
            state: snapshotForState(error.currentState, gameContext.gameId, error.currentVersion, error.game?.name || gameContext.gameName)
          });
          return;
        }

        throw error;
      }

      broadcastGame(gameContext);
      sendJson(res, 200, { ok: true, bonus: result.bonus, validation: result.validation, state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/start") {
      const body = await parseBody(req);
      const authContext = await requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const gameContext = await loadGameContext(getTargetGameId(body, url));
      if (gameContext.state.phase !== "lobby") {
        sendLocalizedError(res, 400, null, "La partita e gia iniziata.", "server.game.alreadyStarted");
        return;
      }

      try {
        const activeGame = await gameSessions.getGame(gameContext.gameId);
        authorize("game:start", { user: authContext.user, game: activeGame.game });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        sendLocalizedError(res, statusCode, error, "Avvio partita non autorizzato.", "server.game.startUnauthorized");
        return;
      }

      if (gameContext.state.players.length < 2) {
        sendLocalizedError(res, 400, null, "Servono almeno 2 giocatori.", "server.game.notEnoughPlayers");
        return;
      }

      const player = getPlayer(gameContext.state, body.playerId);
      if (!player || !playerBelongsToUser(player, authContext.user)) {
        sendLocalizedError(res, 403, null, "Giocatore non valido.", "game.invalidPlayer");
        return;
      }

      startGame(gameContext.state);
      await persistWithAiTurns(gameContext);
      broadcastGame(gameContext);
      sendJson(res, 200, { ok: true, state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/action") {
      const body = await parseBody(req);
      const authContext = await requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const playerId = body.playerId;
      const type = body.type;
      const expectedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion);
      if (body.expectedVersion != null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
        sendLocalizedError(res, 400, null, "expectedVersion non valida.", "server.invalidExpectedVersion");
        return;
      }

      const gameContext = await loadGameContext(getTargetGameId(body, url));
      const player = getPlayer(gameContext.state, playerId);

      if (!player || !playerBelongsToUser(player, authContext.user)) {
        sendLocalizedError(res, 403, null, "Giocatore non valido.", "game.invalidPlayer");
        return;
      }

      function handleVersionConflict(error) {
        if (!error || error.code !== "VERSION_CONFLICT") {
          return false;
        }

        sendJson(res, 409, {
          ...localizedPayload(error, error.message, error.messageKey || "server.versionConflict"),
          code: error.code,
          currentVersion: error.currentVersion,
          state: snapshotForUser(error.currentState, gameContext.gameId, error.currentVersion, error.game?.name || gameContext.gameName, authContext.user)
        });
        return true;
      }

      if (expectedVersion != null && expectedVersion !== gameContext.version) {
        sendJson(res, 409, {
          ...localizedPayload(null, "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.", "server.versionConflict"),
          code: "VERSION_CONFLICT",
          currentVersion: gameContext.version,
          state: snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, authContext.user)
        });
        return;
      }

      function isValidTerritoryId(id) {
        return id && typeof gameContext.state.territories === "object" &&
          Object.prototype.hasOwnProperty.call(gameContext.state.territories, id);
      }

      if (type === "reinforce") {
        const territoryId = String(body.territoryId || "");
        if (!isValidTerritoryId(territoryId)) {
          sendLocalizedError(res, 400, null, "Territorio non valido.", "game.invalidTerritory");
          return;
        }
        const result = applyReinforcement(
          gameContext.state,
          playerId,
          territoryId,
          body.amount
        );
        if (!result.ok) {
          sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
          return;
        }

        try {
          await persistGameContext(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, {
          ok: true,
          state: snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, authContext.user)
        });
        return;
      }

      if (type === "attack" || type === "attackBanzai") {
        let random;
        if (process.env.E2E === "true" && Array.isArray(nextAttackRolls) && nextAttackRolls.length === 2) {
          const queuedRolls = nextAttackRolls.slice();
          nextAttackRolls = null;
          random = () => {
            const roll = queuedRolls.shift();
            if (!roll) {
              return secureRandom();
            }

            return (roll - 0.01) / 6;
          };
        }

        const requestedAttackDice = body.attackDice == null || body.attackDice === "" ? null : Number(body.attackDice);
        const actionFromId = String(body.fromId || "");
        const actionToId = String(body.toId || "");
        if (!isValidTerritoryId(actionFromId) || !isValidTerritoryId(actionToId)) {
          sendLocalizedError(res, 400, null, "Territorio non valido.", "game.invalidTerritory");
          return;
        }
        const result = type === "attackBanzai"
          ? resolveBanzaiAttack(gameContext.state, playerId, actionFromId, actionToId, random, requestedAttackDice)
          : resolveAttack(gameContext.state, playerId, actionFromId, actionToId, random, requestedAttackDice);
        if (!result.ok) {
          sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
          return;
        }

        try {
          await persistGameContext(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, {
          ok: true,
          state: snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, authContext.user),
          rounds: Array.isArray(result.rounds) ? result.rounds : undefined
        });
        return;
      }

      if (type === "moveAfterConquest") {
        const result = moveAfterConquest(gameContext.state, playerId, body.armies);
        if (!result.ok) {
          sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
          return;
        }

        try {
          await persistGameContext(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, { ok: true, state: snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, authContext.user) });
        return;
      }

      if (type === "fortify") {
        const fortifyFromId = String(body.fromId || "");
        const fortifyToId = String(body.toId || "");
        if (!isValidTerritoryId(fortifyFromId) || !isValidTerritoryId(fortifyToId)) {
          sendLocalizedError(res, 400, null, "Territorio non valido.", "game.invalidTerritory");
          return;
        }
        const result = applyFortify(gameContext.state, playerId, fortifyFromId, fortifyToId, body.armies);
        if (!result.ok) {
          sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
          return;
        }

        try {
          await persistGameContext(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, { ok: true, state: snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, authContext.user) });
        return;
      }

      if (type === "endTurn") {
        const result = endTurn(gameContext.state, playerId);
        if (!result.ok) {
          sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
          return;
        }

        try {
          await persistWithAiTurns(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, { ok: true, state: snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, authContext.user) });
        return;
      }

      if (type === "surrender") {
        const result = surrenderPlayer(gameContext.state, playerId);
        if (!result.ok) {
          sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
          return;
        }

        try {
          await persistWithAiTurns(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, {
          ok: true,
          state: snapshotForUser(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName, authContext.user)
        });
        return;
      }

      sendLocalizedError(res, 400, null, "Azione non supportata.", "server.action.unsupported");
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
    const filePath = path.join(publicDir, relativePath);
    if (filePath.indexOf(publicDir) !== 0) {
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

  function handleRequest(req, res) {
    const url = new URL(req.url, "http://" + req.headers.host);

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
