const assert = require("node:assert/strict");
const {
  TurnPhase,
  advanceTurn,
  applyReinforcement,
  createInitialState,
  endTurn,
  startGame
} = require("../../../backend/engine/game-engine.cjs");
const { createFixedRandom } = require("../helpers/random.cjs");

function setupLiveGame() {
  const state = createInitialState();
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  startGame(state, createFixedRandom(new Array(20).fill(0)));
  return state;
}

register("applyReinforcement transitions from reinforcement to attack when pool reaches zero", () => {
  const state = setupLiveGame();
  const currentPlayer = state.players[state.currentTurnIndex];
  const ownedTerritoryId = Object.keys(state.territories).find((territoryId) => state.territories[territoryId].ownerId === currentPlayer.id);

  while (state.reinforcementPool > 0) {
    const result = applyReinforcement(state, currentPlayer.id, ownedTerritoryId);
    assert.equal(result.ok, true);
  }

  assert.equal(state.turnPhase, TurnPhase.ATTACK);
  assert.equal(state.reinforcementPool, 0);
});

register("endTurn transitions from attack to fortify before advancing the turn", () => {
  const state = setupLiveGame();
  const currentPlayer = state.players[state.currentTurnIndex];
  const ownedTerritoryId = Object.keys(state.territories).find((territoryId) => state.territories[territoryId].ownerId === currentPlayer.id);

  while (state.reinforcementPool > 0) {
    applyReinforcement(state, currentPlayer.id, ownedTerritoryId);
  }

  const result = endTurn(state, currentPlayer.id);
  assert.equal(result.ok, true);
  assert.equal(result.requiresFortifyDecision, true);
  assert.equal(state.turnPhase, TurnPhase.FORTIFY);
});

register("endTurn from fortify advances to the next active player reinforcement phase", () => {
  const state = setupLiveGame();
  const firstPlayer = state.players[state.currentTurnIndex];
  const ownedTerritoryId = Object.keys(state.territories).find((territoryId) => state.territories[territoryId].ownerId === firstPlayer.id);

  while (state.reinforcementPool > 0) {
    applyReinforcement(state, firstPlayer.id, ownedTerritoryId);
  }

  endTurn(state, firstPlayer.id);
  const result = endTurn(state, firstPlayer.id);

  assert.equal(result.ok, true);
  assert.equal(state.currentTurnIndex, 1);
  assert.equal(state.turnPhase, TurnPhase.REINFORCEMENT);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.reinforcementPool >= 3, true);
});

register("endTurn fails clearly when reinforcements are still available", () => {
  const state = setupLiveGame();
  const currentPlayer = state.players[state.currentTurnIndex];

  const result = endTurn(state, currentPlayer.id);
  assert.equal(result.ok, false);
  assert.match(result.message, /spendi prima tutti i rinforzi/i);
});

register("advanceTurn skips players with zero territories and can finish the game", () => {
  const state = setupLiveGame();
  state.currentTurnIndex = 0;
  Object.keys(state.territories).forEach((territoryId) => {
    state.territories[territoryId].ownerId = "p1";
  });
  state.turnPhase = TurnPhase.FORTIFY;
  state.reinforcementPool = 0;

  advanceTurn(state);

  assert.equal(state.winnerId, "p1");
  assert.equal(state.phase, "finished");
});

