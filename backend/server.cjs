const http = require("http");
const fs = require("fs");
const path = require("path");
const { createDatastore } = require("./datastore.cjs");
const { createAuthStore } = require("./auth.cjs");
const { authorize } = require("./authorization.cjs");
const { createGameSessionStore } = require("./game-session-store.cjs");
const { createPlayerProfileStore } = require("./player-profile-store.cjs");
const { createConfiguredInitialState, listDiceRuleSets, listSupportedMaps } = require("./new-game-config.cjs");
const { secureRandom } = require("./random.cjs");
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
  tradeCardSet
} = require("./engine/game-engine.cjs");
const { runAiTurn } = require("./engine/ai-player.cjs");

const publicDir = path.join(__dirname, "..", "frontend", "public");
const port = process.env.PORT || 3000;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1000000) {
        reject(new Error("Payload troppo grande"));
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
        reject(new Error("JSON non valido"));
      }
    });
  });
}

function createApp(options = {}) {
  const state = createInitialState();
  let activeGameId = null;
  let activeGameVersion = null;
  let activeGameName = null;
  let nextAttackRolls = null;
  const datastore = createDatastore({
    dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
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
  const initialGame = gameSessions.ensureActiveGame(createInitialState);
  activeGameId = initialGame.game.id;
  activeGameVersion = initialGame.game.version;
  activeGameName = initialGame.game.name;
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, initialGame.state);
  const auth = createAuthStore({
    datastore,
    dataFile: options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    sessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
  });
  const clientsByGameId = new Map();

  function replaceState(nextState) {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, nextState);
  }

  function persistActiveGame(expectedVersion) {
    if (!activeGameId) {
      return null;
    }

    const savedGame = gameSessions.saveGame(activeGameId, state, expectedVersion);
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

  function loadGameContext(gameId) {
    if (!gameId || gameId === activeGameId) {
      return {
        gameId: activeGameId,
        gameName: activeGameName,
        version: activeGameVersion,
        state
      };
    }

    const record = gameSessions.getGame(gameId);
    return {
      gameId: record.game.id,
      gameName: record.game.name,
      version: record.game.version,
      state: record.state
    };
  }

  function persistGameContext(gameContext, expectedVersion) {
    if (!gameContext?.gameId) {
      return null;
    }

    const savedGame = gameSessions.saveGame(gameContext.gameId, gameContext.state, expectedVersion);
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

    const payload = "data: " + JSON.stringify(snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName)) + "\n\n";
    clients.forEach((client) => {
      client.write(payload);
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
        throw new Error(result.error || "Turno AI non riuscito.");
      }

      reports.push(result);
    }

    return reports;
  }

  function persistWithAiTurns(gameContext, expectedVersion) {
    persistGameContext(gameContext, expectedVersion);
    const aiReports = runAiTurnsIfNeeded(gameContext.state);
    if (aiReports.length > 0) {
      persistGameContext(gameContext, gameContext.version);
    }
    return aiReports;
  }

  function resumeAiTurnsForRead(gameContext) {
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
    return body.sessionToken || req.headers["x-session-token"] || null;
  }

  function requireAuth(req, res, body, url = null) {
    const sessionToken = extractSessionToken(req, body, url);
    const user = auth.getUserFromSession(sessionToken);
    if (!user) {
      sendJson(res, 401, { error: "Sessione non valida.", code: "AUTH_REQUIRED" });
      return null;
    }

    return { sessionToken, user };
  }

  function authorizeGameRead(gameId, req, res, url) {
    if (!gameId) {
      return { ok: true, user: null, gameRecord: null };
    }

    const gameRecord = gameSessions.getGame(gameId);
    if (!gameRecord.game.creatorUserId) {
      return { ok: true, user: null, gameRecord };
    }

    const authContext = requireAuth(req, res, {}, url);
    if (!authContext) {
      return null;
    }

    try {
      authorize("game:read", { user: authContext.user, game: gameRecord.game, state: gameRecord.state });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      sendJson(res, statusCode, { error: error.message || "Accesso partita non autorizzato.", code: error.code || null });
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

  function healthSnapshot() {
    const storage = datastore.healthSummary();
    return {
      ok: storage.ok,
      storage,
      activeGameId,
      activeGameVersion,
      hasActiveGame: Boolean(activeGameId)
    };
  }

  async function handleApi(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/health") {
      const health = healthSnapshot();
      sendJson(res, health.ok ? 200 : 503, health);
      return;
    }

    if (process.env.E2E === "true" && req.method === "POST" && url.pathname === "/api/test/reset") {
      const resetGame = gameSessions.createGame(createInitialState(), { name: "Partita test" });
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
        sendJson(res, 400, { error: "I lanci di test devono essere interi tra 1 e 6." });
        return;
      }

      nextAttackRolls = [attackRoll, defendRoll];
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      const gameId = getTargetGameId({}, url);
      const access = authorizeGameRead(gameId, req, res, url);
      if (access === null) {
        return;
      }
      const gameContext = loadGameContext(gameId);
      resumeAiTurnsForRead(gameContext);
      const sessionUser = access && access.user ? access.user : auth.getUserFromSession(extractSessionToken(req, {}, url));
      const resolvedPlayer = resolvePlayerForUser(gameContext.state, sessionUser);
      sendJson(res, 200, {
        ...snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName),
        playerId: resolvedPlayer ? resolvedPlayer.id : null,
        ...(resolvedPlayer ? { playerHand: visibleHandForPlayer(gameContext.state, resolvedPlayer) } : {})
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/games") {
      sendJson(res, 200, { games: gameSessions.listGames(), activeGameId: getTargetGameId({}, url) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/game-options") {
      sendJson(res, 200, { maps: listSupportedMaps(), diceRuleSets: listDiceRuleSets(), playerRange: { min: 2, max: 4 } });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games") {
      const body = await parseBody(req);
      const authContext = requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      try {
        const policy = authorize("game:create", { user: authContext.user });
        const configured = createConfiguredInitialState(body);
        const creatorJoin = addPlayer(configured.state, authContext.user.username, { linkedUserId: policy.actor.id });
        if (!creatorJoin.ok) {
          throw new Error(creatorJoin.error || "Impossibile collegare il creatore alla nuova partita.");
        }
        const created = gameSessions.createGame(configured.state, {
          ...configured.gameInput,
          creatorUserId: policy.actor.id
        });
        activeGameId = created.game.id;
        activeGameVersion = created.game.version;
        activeGameName = created.game.name;
        replaceState(created.state);
        broadcastGame({ gameId: created.game.id, gameName: created.game.name, version: created.game.version, state: created.state });
        sendJson(res, 201, { ok: true, game: created.game, games: gameSessions.listGames(), activeGameId, state: snapshot(), config: configured.config, playerId: creatorJoin.player.id });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        sendJson(res, statusCode, { error: error.message || "Creazione partita non riuscita.", code: error.code || null });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games/open") {
      const body = await parseBody(req);
      const authContext = requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      try {
        const gameRecord = gameSessions.getGame(body.gameId);
        authorize("game:open", { user: authContext.user, game: gameRecord.game, state: gameRecord.state });
        const opened = gameSessions.openGame(body.gameId);
        resumeAiTurnsForRead(opened);
        const resolvedPlayer = resolvePlayerForUser(opened.state, authContext.user);
        sendJson(res, 200, {
          ok: true,
          game: opened.game,
          games: gameSessions.listGames(),
          activeGameId: opened.game.id,
          state: snapshotForState(opened.state, opened.game.id, opened.game.version, opened.game.name),
          playerId: resolvedPlayer ? resolvedPlayer.id : null
        });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        sendJson(res, statusCode, { error: error.message || "Apertura partita non riuscita.", code: error.code || null });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/session") {
      const authContext = requireAuth(req, res, {});
      if (!authContext) {
        return;
      }

      sendJson(res, 200, { user: auth.publicUser(authContext.user) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const authContext = requireAuth(req, res, {});
      if (!authContext) {
        return;
      }

      try {
        sendJson(res, 200, { profile: playerProfiles.getPlayerProfile(authContext.user.username) });
      } catch (error) {
        sendJson(res, 400, { error: error.message || "Profilo non disponibile." });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      const gameId = getTargetGameId({}, url);
      const access = authorizeGameRead(gameId, req, res, url);
      if (access === null) {
        return;
      }
      const gameContext = loadGameContext(gameId);
      resumeAiTurnsForRead(gameContext);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      res.write("data: " + JSON.stringify(snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName)) + "\n\n");
      const key = gameContext.gameId || "__default__";
      if (!clientsByGameId.has(key)) {
        clientsByGameId.set(key, new Set());
      }
      clientsByGameId.get(key).add(res);
      req.on("close", () => {
        const group = clientsByGameId.get(key);
        if (!group) {
          return;
        }
        group.delete(res);
        if (!group.size) {
          clientsByGameId.delete(key);
        }
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await parseBody(req);
      const result = auth.registerPasswordUser(body.username, body.password);
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
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
      const result = auth.loginWithPassword(body.username, body.password);
      if (!result.ok) {
        sendJson(res, 401, { error: result.error });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        sessionToken: result.sessionToken,
        user: result.user,
        availableAuthProviders: ["password", "email", "google", "discord"]
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const body = await parseBody(req);
      auth.logout(extractSessionToken(req, body));
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/join") {
      const body = await parseBody(req);
      const gameContext = loadGameContext(getTargetGameId(body, url));
      const result = addPlayer(gameContext.state, body.name, { isAi: true });
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
        return;
      }

      persistGameContext(gameContext);
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
      const authContext = requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const gameContext = loadGameContext(getTargetGameId(body, url));
      const result = addPlayer(gameContext.state, authContext.user.username, { linkedUserId: authContext.user.id });
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
        return;
      }

      persistGameContext(gameContext);
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
      const authContext = requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const gameContext = loadGameContext(getTargetGameId(body, url));
      const player = getPlayer(gameContext.state, body.playerId);
      if (!player || !playerBelongsToUser(player, authContext.user)) {
        sendJson(res, 403, { error: "Giocatore non valido." });
        return;
      }

      const expectedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion);
      if (body.expectedVersion != null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
        sendJson(res, 400, { error: "expectedVersion non valida." });
        return;
      }

      if (expectedVersion != null && expectedVersion !== gameContext.version) {
        sendJson(res, 409, {
          error: "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.",
          code: "VERSION_CONFLICT",
          currentVersion: gameContext.version,
          state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName)
        });
        return;
      }

      const result = tradeCardSet(gameContext.state, body.playerId, body.cardIds);
      if (!result.ok) {
        sendJson(res, 400, { error: result.message });
        return;
      }

      try {
        persistGameContext(gameContext, expectedVersion);
      } catch (error) {
        if (error && error.code === "VERSION_CONFLICT") {
          sendJson(res, 409, {
            error: error.message,
            code: error.code,
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
      const authContext = requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const gameContext = loadGameContext(getTargetGameId(body, url));
      if (gameContext.state.phase !== "lobby") {
        sendJson(res, 400, { error: "La partita e gia iniziata." });
        return;
      }

      try {
        const activeGame = gameSessions.getGame(gameContext.gameId);
        authorize("game:start", { user: authContext.user, game: activeGame.game });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        sendJson(res, statusCode, { error: error.message || "Avvio partita non autorizzato.", code: error.code || null });
        return;
      }

      if (gameContext.state.players.length < 2) {
        sendJson(res, 400, { error: "Servono almeno 2 giocatori." });
        return;
      }

      const player = getPlayer(gameContext.state, body.playerId);
      if (!player || !playerBelongsToUser(player, authContext.user)) {
        sendJson(res, 403, { error: "Giocatore non valido." });
        return;
      }

      startGame(gameContext.state);
      persistWithAiTurns(gameContext);
      broadcastGame(gameContext);
      sendJson(res, 200, { ok: true, state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/action") {
      const body = await parseBody(req);
      const authContext = requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const playerId = body.playerId;
      const type = body.type;
      const expectedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion);
      if (body.expectedVersion != null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
        sendJson(res, 400, { error: "expectedVersion non valida." });
        return;
      }

      const gameContext = loadGameContext(getTargetGameId(body, url));
      const player = getPlayer(gameContext.state, playerId);

      if (!player || !playerBelongsToUser(player, authContext.user)) {
        sendJson(res, 403, { error: "Giocatore non valido." });
        return;
      }

      function handleVersionConflict(error) {
        if (!error || error.code !== "VERSION_CONFLICT") {
          return false;
        }

        sendJson(res, 409, {
          error: error.message,
          code: error.code,
          currentVersion: error.currentVersion,
          state: snapshotForState(error.currentState, gameContext.gameId, error.currentVersion, error.game?.name || gameContext.gameName)
        });
        return true;
      }

      if (expectedVersion != null && expectedVersion !== gameContext.version) {
        sendJson(res, 409, {
          error: "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.",
          code: "VERSION_CONFLICT",
          currentVersion: gameContext.version,
          state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName)
        });
        return;
      }

      if (type === "reinforce") {
        const result = applyReinforcement(gameContext.state, playerId, String(body.territoryId || ""));
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistGameContext(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, { ok: true, state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName) });
        return;
      }

      if (type === "attack") {
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
        const result = resolveAttack(gameContext.state, playerId, String(body.fromId || ""), String(body.toId || ""), random, requestedAttackDice);
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistGameContext(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, { ok: true, state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName) });
        return;
      }

      if (type === "moveAfterConquest") {
        const result = moveAfterConquest(gameContext.state, playerId, body.armies);
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistGameContext(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, { ok: true, state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName) });
        return;
      }

      if (type === "fortify") {
        const result = applyFortify(gameContext.state, playerId, String(body.fromId || ""), String(body.toId || ""), body.armies);
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistGameContext(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, { ok: true, state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName) });
        return;
      }

      if (type === "endTurn") {
        const result = endTurn(gameContext.state, playerId);
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistWithAiTurns(gameContext, expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcastGame(gameContext);
        sendJson(res, 200, { ok: true, state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName) });
        return;
      }

      sendJson(res, 400, { error: "Azione non supportata." });
      return;
    }

    sendJson(res, 404, { error: "Endpoint non trovato." });
  }

  function serveStatic(res, url) {
    const relativePath = url.pathname === "/"
      ? "/index.html"
      : url.pathname.indexOf("/game/") === 0
        ? "/game.html"
        : url.pathname;
    const filePath = path.join(publicDir, relativePath);
    if (filePath.indexOf(publicDir) !== 0) {
      sendJson(res, 403, { error: "Accesso negato." });
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        sendJson(res, 404, { error: "File non trovato." });
        return;
      }

      const extension = path.extname(filePath);
      const contentTypes = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
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

  const server = http.createServer((req, res) => {
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
        sendJson(res, 500, { error: error.message || "Errore interno." });
      });
  });

  return {
    auth,
    datastore,
    handleApi,
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
  server: app.server,
  state: app.state
};







