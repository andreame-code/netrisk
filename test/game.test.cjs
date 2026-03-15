const test = require("node:test");
const assert = require("node:assert/strict");
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

function setupLobby() {
  const state = createInitialState();
  const first = addPlayer(state, "Alice");
  const second = addPlayer(state, "Bob");
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  return { state, first: first.player, second: second.player };
}

test("addPlayer aggiunge giocatori e impedisce lobby oltre 4", () => {
  const state = createInitialState();
  ["A", "B", "C", "D"].forEach((name) => {
    const result = addPlayer(state, name);
    assert.equal(result.ok, true);
  });

  const overflow = addPlayer(state, "E");
  assert.equal(overflow.ok, false);
  assert.equal(overflow.error, "La lobby e piena.");
});

test("startGame distribuisce tutti i territori e assegna rinforzi iniziali", () => {
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

test("resolveAttack conquista un territorio quando l'attaccante vince", () => {
  const { state, first, second } = setupLobby();
  state.phase = "active";
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.territories.aurora = { ownerId: first.id, armies: 3 };
  state.territories.bastion = { ownerId: second.id, armies: 1 };

  const result = resolveAttack(state, first.id, "aurora", "bastion", () => 0.9);
  assert.equal(result.ok, true);
  assert.equal(state.territories.bastion.ownerId, first.id);
  assert.equal(state.territories.bastion.armies, 1);
  assert.equal(state.territories.aurora.armies, 2);
});

test("resolveAttack rifiuta attacchi non validi", () => {
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

test("advanceTurn salta i giocatori eliminati e ricalcola i rinforzi", () => {
  const { state, first, second } = setupLobby();
  const third = addPlayer(state, "Cara").player;
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

test("publicState espone conteggi e stato corrente senza mutare lo state", () => {
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
