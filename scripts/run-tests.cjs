const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  addPlayer,
  advanceTurn,
  computeReinforcements,
  createInitialState,
  publicState,
  resolveAttack,
  startGame,
  territoriesOwnedBy
} = require("../src/game.cjs");
const { createAuthStore } = require("../src/auth.cjs");
const { createApp } = require("../src/server.cjs");

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
  const app = createApp({ dataFile: tempFile });
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
  assert.equal(state.reinforcementPool, 3);
  assert.equal(territoriesOwnedBy(state, first.id).length + territoriesOwnedBy(state, second.id).length, 9);
  Object.values(state.territories).forEach((territory) => {
    assert.equal(territory.armies >= 1, true);
    assert.notEqual(territory.ownerId, null);
  });
});

register("resolveAttack conquista un territorio quando l'attaccante vince", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 1 };

  const random = (() => {
    const values = [0.9, 0.1];
    return () => values.shift();
  })();

  const result = resolveAttack(state, first.id, "aurora", "bastion", random);
  assert.equal(result.ok, true);
  assert.equal(state.territories.bastion.ownerId, first.id);
  assert.equal(state.territories.bastion.armies, 1);
  assert.equal(state.territories.aurora.armies, 2);
});

register("resolveAttack rifiuta attacchi non validi", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 2;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 2 };

  const result = resolveAttack(state, first.id, "aurora", "bastion", () => 0.9);
  assert.equal(result.ok, false);
  assert.equal(result.message, "Devi prima spendere tutti i rinforzi.");
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
});

register("publicState espone conteggi e stato corrente senza mutare lo state", () => {
  const { state, first } = setupLobby();
  state.phase = "active";
  state.currentTurnIndex = 0;
  state.territories.aurora = { ownerId: first.id, armies: 4 };
  const snapshot = publicState(state);

  assert.equal(snapshot.phase, "active");
  assert.equal(snapshot.currentPlayerId, first.id);
  assert.equal(snapshot.players[0].territoryCount >= 1, true);
  assert.equal(snapshot.map.find((territory) => territory.id === "aurora").armies, 4);
});

register("GET /api/state risponde con lo stato pubblico", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/state`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.phase === "lobby" || payload.phase === "active" || payload.phase === "finished", true);
    assert.equal(Array.isArray(payload.map), true);
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
    assert.equal(Boolean(loginPayload.sessionToken), true);

    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { "x-session-token": loginPayload.sessionToken }
    });
    assert.equal(sessionResponse.status, 200);

    const joinResponse = await fetch(`${baseUrl}/api/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": loginPayload.sessionToken
      },
      body: JSON.stringify({ sessionToken: loginPayload.sessionToken })
    });
    assert.equal(joinResponse.status, 201);
    const joined = await joinResponse.json();
    assert.equal(joined.user.username, unique);
    assert.equal(Boolean(joined.playerId), true);
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
