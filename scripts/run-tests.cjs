const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  addPlayer,
  advanceTurn,
  applyReinforcement,
  applyFortify,
  computeReinforcements,
  createInitialState,
  endTurn,
  moveAfterConquest,
  publicState,
  resolveAttack,
  startGame,
  territoriesOwnedBy
} = require("../backend/engine/game-engine.cjs");
const { createAuthStore } = require("../backend/auth.cjs");
const { createApp } = require("../backend/server.cjs");

const tests = [];

function register(name, fn) {
  tests.push({ name, fn });
}

function setupLobby() {
  const state = createInitialState();
  const first = addPlayer(state, "Alice");
  const second = addPlayer(state, "Bob");
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  return { state, first: first.player, second: second.player };
}

async function withServer(run) {
  const tempFile = path.join(__dirname, `tmp-users-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const tempGamesFile = path.join(__dirname, `tmp-games-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const app = createApp({ dataFile: tempFile, gamesFile: tempGamesFile });
  const listener = app.server.listen(0);

  await new Promise((resolve, reject) => {
    listener.once("listening", resolve);
    listener.once("error", reject);
  });

  try {
    const address = listener.address();
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => {
      if (!listener.listening) {
        resolve();
        return;
      }

      listener.close(() => resolve());
    });

    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    if (fs.existsSync(tempGamesFile)) {
      fs.unlinkSync(tempGamesFile);
    }
  }
}

register("auth store registra e autentica utenti password", () => {
  const tempFile = path.join(__dirname, "tmp-users.json");
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }

  const auth = createAuthStore({ dataFile: tempFile });
  const registered = auth.registerPasswordUser("tester", "secret");
  assert.equal(registered.ok, true);

  const login = auth.loginWithPassword("tester", "secret");
  assert.equal(login.ok, true);
  assert.equal(Boolean(login.sessionToken), true);
  assert.equal(auth.getUserFromSession(login.sessionToken).username, "tester");

  fs.unlinkSync(tempFile);
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
  assert.equal(state.reinforcementPool, 3);
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
    const values = [0.9, 0.1];
    return () => values.shift();
  })();

  const result = resolveAttack(state, first.id, "aurora", "bastion", random);
  assert.equal(result.ok, true);
  assert.equal(state.territories.bastion.ownerId, first.id);
  assert.equal(state.pendingConquest.toId, "bastion");
  assert.equal(state.territories.bastion.armies, 0);
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
    const values = [0.9, 0.1];
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
});

register("API games create + list + open persiste e riapre una sessione", async () => {
  await withServer(async (baseUrl) => {
    const initialList = await fetch(baseUrl + "/api/games");
    assert.equal(initialList.status, 200);
    const initialPayload = await initialList.json();
    assert.equal(Array.isArray(initialPayload.games), true);

    const created = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Campagna test" })
    });
    assert.equal(created.status, 201);
    const createdPayload = await created.json();
    assert.equal(createdPayload.game.name, "Campagna test");
    assert.equal(Boolean(createdPayload.game.id), true);
    assert.equal(createdPayload.state.phase, "lobby");
    assert.equal(createdPayload.activeGameId, createdPayload.game.id);

    const listed = await fetch(baseUrl + "/api/games");
    const listedPayload = await listed.json();
    assert.equal(listedPayload.games.some((game) => game.id === createdPayload.game.id), true);

    const opened = await fetch(baseUrl + "/api/games/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: createdPayload.game.id })
    });
    assert.equal(opened.status, 200);
    const openedPayload = await opened.json();
    assert.equal(openedPayload.activeGameId, createdPayload.game.id);
    assert.equal(openedPayload.state.gameId, createdPayload.game.id);
  });
});

register("API game session persists mutations across reopen", async () => {
  await withServer(async (baseUrl) => {
    const createdResponse = await fetch(baseUrl + "/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Persistenza campagna" })
    });
    assert.equal(createdResponse.status, 201);
    const createdPayload = await createdResponse.json();
    const gameId = createdPayload.game.id;

    const firstUser = `persist_a_${Date.now()}`;
    const secondUser = `persist_b_${Date.now()}`;

    const registerFirst = await fetch(baseUrl + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: firstUser, password: "secret" })
    });
    assert.equal(registerFirst.status, 201);

    const registerSecond = await fetch(baseUrl + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: secondUser, password: "secret" })
    });
    assert.equal(registerSecond.status, 201);

    const loginFirst = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: firstUser, password: "secret" })
    });
    const firstAuth = await loginFirst.json();

    const joinFirst = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": firstAuth.sessionToken
      },
      body: JSON.stringify({ sessionToken: firstAuth.sessionToken })
    });
    assert.equal(joinFirst.status, 201);
    const firstJoinPayload = await joinFirst.json();

    const loginSecond = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: secondUser, password: "secret" })
    });
    const secondAuth = await loginSecond.json();

    const joinSecond = await fetch(baseUrl + "/api/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": secondAuth.sessionToken
      },
      body: JSON.stringify({ sessionToken: secondAuth.sessionToken })
    });
    assert.equal(joinSecond.status, 201);

    const startResponse = await fetch(baseUrl + "/api/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": firstAuth.sessionToken
      },
      body: JSON.stringify({ sessionToken: firstAuth.sessionToken, playerId: firstJoinPayload.playerId })
    });
    assert.equal(startResponse.status, 200);
    const startedPayload = await startResponse.json();

    const ownedTerritoryId = startedPayload.state.map.find((territory) => territory.ownerId === firstJoinPayload.playerId).id;

    const reinforceResponse = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": firstAuth.sessionToken
      },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId })
    });
    assert.equal(reopenedResponse.status, 200);
    const reopenedPayload = await reopenedResponse.json();

    const reopenedTerritory = reopenedPayload.state.map.find((territory) => territory.id === ownedTerritoryId);
    assert.equal(reopenedPayload.state.gameId, gameId);
    assert.equal(reopenedPayload.state.phase, "active");
    assert.equal(reopenedTerritory.ownerId, firstJoinPayload.playerId);
    assert.equal(reopenedTerritory.armies >= 2, true);
  });
});

register("GET /api/state risponde con lo stato pubblico", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/state`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(Array.isArray(payload.map), true);
    assert.equal(Array.isArray(payload.continents), true);
  });
});

register("API register + login + join completa il flusso di accesso", async () => {
  await withServer(async (baseUrl) => {
    const unique = `api_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: unique, password: "secret" })
    });
    assert.equal(registerResponse.status, 201);

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: unique, password: "secret" })
    });
    assert.equal(loginResponse.status, 200);
    const loginPayload = await loginResponse.json();

    const joinResponse = await fetch(`${baseUrl}/api/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": loginPayload.sessionToken
      },
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
    } catch (error) {
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
