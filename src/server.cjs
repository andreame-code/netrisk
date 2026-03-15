const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  addPlayer,
  advanceTurn,
  createInitialState,
  getCurrentPlayer,
  getPlayer,
  publicState,
  resolveAttack,
  startGame
} = require("./game.cjs");

const publicDir = path.join(__dirname, "..", "public");
const port = process.env.PORT || 3000;
const state = createInitialState();
const clients = new Set();

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

function snapshot() {
  return publicState(state);
}

function broadcast() {
  const payload = "data: " + JSON.stringify(snapshot()) + "\n\n";
  clients.forEach((client) => {
    client.write(payload);
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, snapshot());
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

  if (req.method === "POST" && url.pathname === "/api/join") {
    const body = await parseBody(req);
    const result = addPlayer(state, body.name);
    if (!result.ok) {
      sendJson(res, 400, { error: result.error });
      return;
    }

    broadcast();
    sendJson(res, result.rejoined ? 200 : 201, { playerId: result.player.id, state: snapshot() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/start") {
    const body = await parseBody(req);
    if (state.phase !== "lobby") {
      sendJson(res, 400, { error: "La partita e gia iniziata." });
      return;
    }

    if (state.players.length < 2) {
      sendJson(res, 400, { error: "Servono almeno 2 giocatori." });
      return;
    }

    if (!getPlayer(state, body.playerId)) {
      sendJson(res, 403, { error: "Giocatore non valido." });
      return;
    }

    startGame(state);
    broadcast();
    sendJson(res, 200, { ok: true, state: snapshot() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/action") {
    const body = await parseBody(req);
    const playerId = body.playerId;
    const type = body.type;
    const player = getPlayer(state, playerId);

    if (!player) {
      sendJson(res, 403, { error: "Giocatore non valido." });
      return;
    }

    if (type === "reinforce") {
      const territoryId = String(body.territoryId || "");
      const territoryState = state.territories[territoryId];

      if (state.phase !== "active") {
        sendJson(res, 400, { error: "La partita non e attiva." });
        return;
      }

      if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
        sendJson(res, 400, { error: "Non e il tuo turno." });
        return;
      }

      if (state.reinforcementPool <= 0) {
        sendJson(res, 400, { error: "Non hai rinforzi disponibili." });
        return;
      }

      if (!territoryState || territoryState.ownerId !== playerId) {
        sendJson(res, 400, { error: "Puoi rinforzare solo un tuo territorio." });
        return;
      }

      territoryState.armies += 1;
      state.reinforcementPool -= 1;
      state.lastAction = {
        type: "reinforce",
        summary: player.name + " rinforza " + territoryId + "."
      };
      state.log.unshift(player.name + " aggiunge 1 armata a " + territoryId + ". Rinforzi rimasti: " + state.reinforcementPool + ".");
      state.log = state.log.slice(0, 12);
      broadcast();
      sendJson(res, 200, { ok: true, state: snapshot() });
      return;
    }

    if (type === "attack") {
      const result = resolveAttack(state, playerId, String(body.fromId || ""), String(body.toId || ""));
      if (!result.ok) {
        sendJson(res, 400, { error: result.message });
        return;
      }

      broadcast();
      sendJson(res, 200, { ok: true, state: snapshot() });
      return;
    }

    if (type === "endTurn") {
      if (state.phase !== "active") {
        sendJson(res, 400, { error: "La partita non e attiva." });
        return;
      }

      if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
        sendJson(res, 400, { error: "Non e il tuo turno." });
        return;
      }

      if (state.reinforcementPool > 0) {
        sendJson(res, 400, { error: "Spendi prima tutti i rinforzi." });
        return;
      }

      state.log.unshift(player.name + " termina il turno.");
      state.log = state.log.slice(0, 12);
      advanceTurn(state);
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

if (require.main === module) {
  server.listen(port, () => {
    console.log("Server attivo su http://localhost:" + port);
  });
}

module.exports = {
  handleApi,
  parseBody,
  sendJson,
  server,
  state
};
