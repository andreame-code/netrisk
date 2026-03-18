const http = require("http");
const fs = require("fs");
const path = require("path");
const { createAuthStore } = require("./auth.cjs");
const { createGameSessionStore } = require("./game-session-store.cjs");
const { createPlayerProfileStore } = require("./player-profile-store.cjs");
const {
  addPlayer,
  applyFortify,
  applyReinforcement,
  createInitialState,
  endTurn,
  getPlayer,
  moveAfterConquest,
  publicState,
  resolveAttack,
  startGame
} = require("./engine/game-engine.cjs");

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
    return savedGame;
  }

  function snapshotForState(nextState, gameId, version) {
    return { ...publicState(nextState), gameId, version };
  }

  function snapshot() {
    return snapshotForState(state, activeGameId, activeGameVersion);
  }

  function broadcast() {
    const payload = "data: " + JSON.stringify(snapshot()) + "\n\n";
    clients.forEach((client) => {
      client.write(payload);
    });
  }

  function extractSessionToken(req, body = {}) {
    return body.sessionToken || req.headers["x-session-token"] || null;
  }

  function requireAuth(req, res, body) {
    const sessionToken = extractSessionToken(req, body);
    const user = auth.getUserFromSession(sessionToken);
    if (!user) {
      sendJson(res, 401, { error: "Sessione non valida." });
      return null;
    }

    return { sessionToken, user };
  }

  async function handleApi(req, res, url) {
    if (process.env.E2E === "true" && req.method === "POST" && url.pathname === "/api/test/reset") {
      const nextState = createInitialState();
      replaceState(nextState);
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
      sendJson(res, 200, snapshot());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/games") {
      sendJson(res, 200, { games: gameSessions.listGames(), activeGameId });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games") {
      const body = await parseBody(req);

      try {
        const created = gameSessions.createGame(createInitialState(), { name: body.name });
        activeGameId = created.game.id;
        activeGameVersion = created.game.version;
        replaceState(created.state);
        broadcast();
        sendJson(res, 201, { ok: true, game: created.game, games: gameSessions.listGames(), activeGameId, state: snapshot() });
      } catch (error) {
        sendJson(res, 400, { error: error.message || "Creazione partita non riuscita." });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/games/open") {
      const body = await parseBody(req);

      try {
        const opened = gameSessions.openGame(body.gameId);
        activeGameId = opened.game.id;
        activeGameVersion = opened.game.version;
        replaceState(opened.state);
        broadcast();
        sendJson(res, 200, { ok: true, game: opened.game, games: gameSessions.listGames(), activeGameId, state: snapshot() });
      } catch (error) {
        sendJson(res, 400, { error: error.message || "Apertura partita non riuscita." });
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

    if (req.method === "POST" && url.pathname === "/api/join") {
      const body = await parseBody(req);
      const authContext = requireAuth(req, res, body);
      if (!authContext) {
        return;
      }

      const result = addPlayer(state, authContext.user.username);
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

      if (state.players.length < 2) {
        sendJson(res, 400, { error: "Servono almeno 2 giocatori." });
        return;
      }

      const player = getPlayer(state, body.playerId);
      if (!player || player.name !== authContext.user.username) {
        sendJson(res, 403, { error: "Giocatore non valido." });
        return;
      }

      startGame(state);
      persistActiveGame();
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

      if (!player || player.name !== authContext.user.username) {
        sendJson(res, 403, { error: "Giocatore non valido." });
        return;
      }

      function handleVersionConflict(error) {
        if (!error || error.code !== "VERSION_CONFLICT") {
          return false;
        }

        activeGameVersion = error.currentVersion;
        sendJson(res, 409, {
          error: error.message,
          code: error.code,
          currentVersion: error.currentVersion,
          state: snapshotForState(error.currentState, activeGameId, error.currentVersion)
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

      sendJson(res, 400, { error: "Azione non supportata." });
      return;
    }

    sendJson(res, 404, { error: "Endpoint non trovato." });
  }

  function serveStatic(res, url) {
    const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
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
