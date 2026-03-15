const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const publicDir = path.join(__dirname, "..", "public");
const port = process.env.PORT || 3000;

const territories = [
  { id: "aurora", name: "Aurora", neighbors: ["bastion", "cinder", "delta"] },
  { id: "bastion", name: "Bastion", neighbors: ["aurora", "ember", "forge"] },
  { id: "cinder", name: "Cinder", neighbors: ["aurora", "delta", "ember"] },
  { id: "delta", name: "Delta", neighbors: ["aurora", "cinder", "grove", "harbor"] },
  { id: "ember", name: "Ember", neighbors: ["bastion", "cinder", "forge", "harbor"] },
  { id: "forge", name: "Forge", neighbors: ["bastion", "ember", "harbor", "ion"] },
  { id: "grove", name: "Grove", neighbors: ["delta", "harbor"] },
  { id: "harbor", name: "Harbor", neighbors: ["delta", "ember", "forge", "grove", "ion"] },
  { id: "ion", name: "Ion", neighbors: ["forge", "harbor"] }
];

const palette = ["#e85d04", "#0f4c5c", "#6a994e", "#8338ec"];

const state = {
  phase: "lobby",
  players: [],
  territories: Object.fromEntries(
    territories.map((territory) => [territory.id, { ownerId: null, armies: 0 }])
  ),
  currentTurnIndex: 0,
  reinforcementPool: 0,
  winnerId: null,
  log: ["Lobby creata. Unisciti e avvia la partita."],
  lastAction: null
};

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

function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = copy[i];
    copy[i] = copy[j];
    copy[j] = current;
  }
  return copy;
}

function getPlayer(playerId) {
  return state.players.find((player) => player.id === playerId) || null;
}

function getCurrentPlayer() {
  return state.players.length ? state.players[state.currentTurnIndex] : null;
}

function territoriesOwnedBy(playerId) {
  return territories.filter((territory) => state.territories[territory.id].ownerId === playerId);
}

function computeReinforcements(playerId) {
  return Math.max(3, Math.floor(territoriesOwnedBy(playerId).length / 3));
}

function appendLog(message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 12);
}

function publicState() {
  const currentPlayer = getCurrentPlayer();
  return {
    phase: state.phase,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      connected: player.connected,
      territoryCount: territoriesOwnedBy(player.id).length,
      eliminated: state.phase !== "lobby" && territoriesOwnedBy(player.id).length === 0
    })),
    map: territories.map((territory) => ({
      id: territory.id,
      name: territory.name,
      neighbors: territory.neighbors,
      ownerId: state.territories[territory.id].ownerId,
      armies: state.territories[territory.id].armies
    })),
    currentPlayerId: currentPlayer ? currentPlayer.id : null,
    reinforcementPool: state.reinforcementPool,
    winnerId: state.winnerId,
    log: state.log,
    lastAction: state.lastAction
  };
}

function broadcast() {
  const payload = "data: " + JSON.stringify(publicState()) + "\n\n";
  clients.forEach((client) => {
    client.write(payload);
  });
}

function startGame() {
  const shuffledTerritories = shuffle(territories.map((territory) => territory.id));
  state.phase = "active";
  state.winnerId = null;
  state.currentTurnIndex = 0;
  state.lastAction = null;

  shuffledTerritories.forEach((territoryId) => {
    state.territories[territoryId] = { ownerId: null, armies: 0 };
  });

  shuffledTerritories.forEach((territoryId, index) => {
    const player = state.players[index % state.players.length];
    state.territories[territoryId] = { ownerId: player.id, armies: 1 };
  });

  const firstPlayer = getCurrentPlayer();
  state.reinforcementPool = computeReinforcements(firstPlayer.id);
  appendLog("Partita iniziata. Turno di " + firstPlayer.name + " con " + state.reinforcementPool + " rinforzi.");
}

function declareWinnerIfNeeded() {
  const activePlayers = state.players.filter((player) => territoriesOwnedBy(player.id).length > 0);
  if (activePlayers.length === 1) {
    state.winnerId = activePlayers[0].id;
    state.phase = "finished";
    appendLog(activePlayers[0].name + " conquista la mappa e vince la partita.");
    return true;
  }
  return false;
}

function advanceTurn() {
  if (state.winnerId || declareWinnerIfNeeded()) {
    return;
  }

  let nextIndex = state.currentTurnIndex;
  for (let step = 0; step < state.players.length; step += 1) {
    nextIndex = (nextIndex + 1) % state.players.length;
    const candidate = state.players[nextIndex];
    if (territoriesOwnedBy(candidate.id).length > 0) {
      state.currentTurnIndex = nextIndex;
      state.reinforcementPool = computeReinforcements(candidate.id);
      appendLog("Nuovo turno: " + candidate.name + " riceve " + state.reinforcementPool + " rinforzi.");
      return;
    }
  }
}

function resolveAttack(playerId, fromId, toId) {
  const attacker = getPlayer(playerId);
  const from = state.territories[fromId];
  const to = state.territories[toId];
  const territory = territories.find((item) => item.id === fromId);

  if (!attacker || !from || !to || !territory) {
    return { ok: false, message: "Territori non validi." };
  }

  if (state.phase !== "active") {
    return { ok: false, message: "La partita non e attiva." };
  }

  if (!getCurrentPlayer() || getCurrentPlayer().id !== playerId) {
    return { ok: false, message: "Non e il tuo turno." };
  }

  if (state.reinforcementPool > 0) {
    return { ok: false, message: "Devi prima spendere tutti i rinforzi." };
  }

  if (from.ownerId !== playerId || to.ownerId === playerId) {
    return { ok: false, message: "Puoi attaccare solo da un tuo territorio verso uno nemico." };
  }

  if (territory.neighbors.indexOf(toId) === -1) {
    return { ok: false, message: "I territori non sono confinanti." };
  }

  if (from.armies < 2) {
    return { ok: false, message: "Servono almeno 2 armate per attaccare." };
  }

  const attackRoll = Math.ceil(Math.random() * 6);
  const defendRoll = Math.ceil(Math.random() * 6);
  from.armies -= 1;
  let summary;

  if (attackRoll > defendRoll) {
    to.armies -= 1;
    summary = attacker.name + " attacca " + toId + ": " + attackRoll + " contro " + defendRoll + ".";
    if (to.armies <= 0) {
      to.ownerId = playerId;
      to.armies = 1;
      summary += " " + attacker.name + " conquista " + toId + ".";
    } else {
      summary += " Il difensore perde 1 armata.";
    }
  } else {
    summary = attacker.name + " fallisce l'attacco su " + toId + ": " + attackRoll + " contro " + defendRoll + ".";
  }

  state.lastAction = { type: "attack", summary, fromId, toId };
  appendLog(summary);
  declareWinnerIfNeeded();
  return { ok: true };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, publicState());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    res.write("data: " + JSON.stringify(publicState()) + "\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/join") {
    const body = await parseBody(req);
    const name = String(body.name || "").trim().slice(0, 24);
    if (!name) {
      sendJson(res, 400, { error: "Inserisci un nome." });
      return;
    }

    const existing = state.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.connected = true;
      appendLog(existing.name + " si ricollega alla lobby.");
      broadcast();
      sendJson(res, 200, { playerId: existing.id, state: publicState() });
      return;
    }

    if (state.phase !== "lobby") {
      sendJson(res, 400, { error: "La partita e gia iniziata." });
      return;
    }

    if (state.players.length >= 4) {
      sendJson(res, 400, { error: "La lobby e piena." });
      return;
    }

    const player = {
      id: randomId(),
      name,
      color: palette[state.players.length % palette.length],
      connected: true
    };

    state.players.push(player);
    appendLog(player.name + " entra nella lobby.");
    broadcast();
    sendJson(res, 201, { playerId: player.id, state: publicState() });
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

    if (!getPlayer(body.playerId)) {
      sendJson(res, 403, { error: "Giocatore non valido." });
      return;
    }

    startGame();
    broadcast();
    sendJson(res, 200, { ok: true, state: publicState() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/action") {
    const body = await parseBody(req);
    const playerId = body.playerId;
    const type = body.type;
    const player = getPlayer(playerId);

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

      if (!getCurrentPlayer() || getCurrentPlayer().id !== playerId) {
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
      appendLog(player.name + " aggiunge 1 armata a " + territoryId + ". Rinforzi rimasti: " + state.reinforcementPool + ".");
      broadcast();
      sendJson(res, 200, { ok: true, state: publicState() });
      return;
    }

    if (type === "attack") {
      const result = resolveAttack(playerId, String(body.fromId || ""), String(body.toId || ""));
      if (!result.ok) {
        sendJson(res, 400, { error: result.message });
        return;
      }

      broadcast();
      sendJson(res, 200, { ok: true, state: publicState() });
      return;
    }

    if (type === "endTurn") {
      if (state.phase !== "active") {
        sendJson(res, 400, { error: "La partita non e attiva." });
        return;
      }

      if (!getCurrentPlayer() || getCurrentPlayer().id !== playerId) {
        sendJson(res, 400, { error: "Non e il tuo turno." });
        return;
      }

      if (state.reinforcementPool > 0) {
        sendJson(res, 400, { error: "Spendi prima tutti i rinforzi." });
        return;
      }

      appendLog(player.name + " termina il turno.");
      advanceTurn();
      broadcast();
      sendJson(res, 200, { ok: true, state: publicState() });
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

server.listen(port, () => {
  console.log("Server attivo su http://localhost:" + port);
});
