const http = require("http");
const fs = require("fs");
const path = require("path");
const { createAuthStore } = require("./auth.cjs");
const { authorize } = require("./authorization.cjs");
const { createGameSessionStore } = require("./game-session-store.cjs");
const { createPlayerProfileStore } = require("./player-profile-store.cjs");
const { createConfiguredInitialState, SUPPORTED_MAPS } = require("./new-game-config.cjs");
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
  startGame
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
  const gamesFile = options.gamesFile || path.join(__dirname, "..", "data", "games.json");
  const gameSessions = createGameSessionStore({
    dataFile: gamesFile
  });
  const playerProfiles = createPlayerProfileStore({
    gamesFile
  });
  const initialGame = gameSessions.ensureActiveGame(createInitialState);
  activeGameId = initialGame.game.id;
  activeGameVersion = initialGame.game.version;
  activeGameName = initialGame.game.name;
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, initialGame.state);
  const auth = createAuthStore({
    dataFile: options.dataFile || path.join(__dirname, "..", "data", "users.json")
  });
  const clients = new Set();

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

  function broadcast() {
    const payload = "data: " + JSON.stringify(snapshot()) + "\n\n";
    clients.forEach((client) => {
      client.write(payload);
    });
  }

  function runAiTurnsIfNeeded() {
    const reports = [];
    const maxTurns = Math.max(4, state.players.length * 4);

    for (let step = 0; step < maxTurns; step += 1) {
      const currentPlayer = getCurrentPlayer(state);
      if (!currentPlayer || !currentPlayer.isAi || state.phase !== "active" || state.winnerId) {
        break;
      }

      const result = runAiTurn(state);
      if (!result.ok) {
        throw new Error(result.error || "Turno AI non riuscito.");
      }

      reports.push(result);
    }

    return reports;
  }

  function persistWithAiTurns(expectedVersion) {
    persistActiveGame(expectedVersion);
    const aiReports = runAiTurnsIfNeeded();
    if (aiReports.length > 0) {
      persistActiveGame(activeGameVersion);
    }
    return aiReports;
  }

  function extractSessionToken(req, body = {}, url = null) {
    return body.sessionToken || req.headers["x-session-token"] || (url ? url.searchParams.get("sessionToken") : null) || null;
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

  function authorizeActiveGameRead(req, res, url) {
    if (!activeGameId) {
      return { ok: true, user: null };
    }

    const gameRecord = gameSessions.getGame(activeGameId);
    if (!gameRecord.game.creatorUserId) {
      return { ok: true, user: null };
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

    return authContext;
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

  async function handleApi(req, res, url) {
    if (process.env.E2E === "true" && req.method === "POST" && url.pathname === "/api/test/reset") {
      const resetGame = gameSessions.createGame(createInitialState(), { name: "Partita test" });
      activeGameId = resetGame.game.id;
      activeGameVersion = resetGame.game.version;
      activeGameName = resetGame.game.name;
      replaceState(resetGame.state);
      nextAttackRolls = null;
      broadcast();
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
      const access = authorizeActiveGameRead(req, res, url);
      if (access === null) {
        return;
      }
      const sessionUser = access && access.user ? access.user : auth.getUserFromSession(extractSessionToken(req, {}, url));
      const resolvedPlayer = resolvePlayerForUser(state, sessionUser);
      sendJson(res, 200, { ...snapshot(), playerId: resolvedPlayer ? resolvedPlayer.id : null });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/games") {
      sendJson(res, 200, { games: gameSessions.listGames(), activeGameId });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/game-options") {
      sendJson(res, 200, { maps: SUPPORTED_MAPS, playerRange: { min: 2, max: 4 } });
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
        const created = gameSessions.createGame(configured.state, {
          ...configured.gameInput,
          creatorUserId: policy.actor.id
        });
        activeGameId = created.game.id;
        activeGameVersion = created.game.version;
        activeGameName = created.game.name;
        replaceState(created.state);
        broadcast();
        sendJson(res, 201, { ok: true, game: created.game, games: gameSessions.listGames(), activeGameId, state: snapshot(), config: configured.config });
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
        activeGameId = opened.game.id;
        activeGameVersion = opened.game.version;
        activeGameName = opened.game.name;
        replaceState(opened.state);
        broadcast();
        const resolvedPlayer = resolvePlayerForUser(opened.state, authContext.user);
        sendJson(res, 200, { ok: true, game: opened.game, games: gameSessions.listGames(), activeGameId, state: snapshot(), playerId: resolvedPlayer ? resolvedPlayer.id : null });
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
      const access = authorizeActiveGameRead(req, res, url);
      if (access === null) {
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      res.write("data: " + JSON.stringify(snapshot()) + "\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
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
      const result = addPlayer(state, body.name, { isAi: true });
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
        return;
      }

      persistActiveGame();
      broadcast();
      sendJson(res, result.rejoined ? 200 : 201, {
        playerId: result.player.id,
        state: snapshot(),
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

      const result = addPlayer(state, authContext.user.username, { linkedUserId: authContext.user.id });
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
        return;
      }

      persistActiveGame();
      broadcast();
      sendJson(res, result.rejoined ? 200 : 201, {
        playerId: result.player.id,
        state: snapshot(),
        user: auth.publicUser(authContext.user)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/start") {
      const body = await parseBody(req);
      const authContext = requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      if (state.phase !== "lobby") {
        sendJson(res, 400, { error: "La partita e gia iniziata." });
        return;
      }

      try {
        const activeGame = gameSessions.getGame(activeGameId);
        authorize("game:start", { user: authContext.user, game: activeGame.game });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        sendJson(res, statusCode, { error: error.message || "Avvio partita non autorizzato.", code: error.code || null });
        return;
      }

      if (state.players.length < 2) {
        sendJson(res, 400, { error: "Servono almeno 2 giocatori." });
        return;
      }

      const player = getPlayer(state, body.playerId);
      if (!player || !playerBelongsToUser(player, authContext.user)) {
        sendJson(res, 403, { error: "Giocatore non valido." });
        return;
      }

      startGame(state);
      persistWithAiTurns();
      broadcast();
      sendJson(res, 200, { ok: true, state: snapshot() });
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

      const player = getPlayer(state, playerId);

      if (!player || !playerBelongsToUser(player, authContext.user)) {
        sendJson(res, 403, { error: "Giocatore non valido." });
        return;
      }

      function handleVersionConflict(error) {
        if (!error || error.code !== "VERSION_CONFLICT") {
          return false;
        }

        activeGameVersion = error.currentVersion;
        activeGameName = error.game?.name || activeGameName;
        sendJson(res, 409, {
          error: error.message,
          code: error.code,
          currentVersion: error.currentVersion,
          state: snapshotForState(error.currentState, activeGameId, error.currentVersion, activeGameName)
        });
        return true;
      }

      if (expectedVersion != null && expectedVersion !== activeGameVersion) {
        sendJson(res, 409, {
          error: "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.",
          code: "VERSION_CONFLICT",
          currentVersion: activeGameVersion,
          state: snapshot()
        });
        return;
      }

      if (type === "reinforce") {
        const result = applyReinforcement(state, playerId, String(body.territoryId || ""));
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistActiveGame(expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcast();
        sendJson(res, 200, { ok: true, state: snapshot() });
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
              return Math.random();
            }

            return (roll - 0.01) / 6;
          };
        }

        const result = resolveAttack(state, playerId, String(body.fromId || ""), String(body.toId || ""), random);
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistActiveGame(expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcast();
        sendJson(res, 200, { ok: true, state: snapshot() });
        return;
      }

      if (type === "moveAfterConquest") {
        const result = moveAfterConquest(state, playerId, body.armies);
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistActiveGame(expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcast();
        sendJson(res, 200, { ok: true, state: snapshot() });
        return;
      }

      if (type === "fortify") {
        const result = applyFortify(state, playerId, String(body.fromId || ""), String(body.toId || ""), body.armies);
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistActiveGame(expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcast();
        sendJson(res, 200, { ok: true, state: snapshot() });
        return;
      }

      if (type === "endTurn") {
        const result = endTurn(state, playerId);
        if (!result.ok) {
          sendJson(res, 400, { error: result.message });
          return;
        }

        try {
          persistWithAiTurns(expectedVersion);
        } catch (error) {
          if (handleVersionConflict(error)) {
            return;
          }
          throw error;
        }
        broadcast();
        sendJson(res, 200, { ok: true, state: snapshot() });
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
        ".js": "text/javascript; charset=utf-8"
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
  handleApi: app.handleApi,
  server: app.server,
  state: app.state
};



