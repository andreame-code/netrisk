const assert = require("node:assert/strict");
const { createInitialState, declareWinnerIfNeeded, getMapTerritories, publicState } = require("../../../backend/engine/game-engine.cjs");

function setupLiveState() {
  const state = createInitialState();
  state.phase = "active";
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  getMapTerritories(state).forEach((territory) => {
    state.territories[territory.id] = { ownerId: "p1", armies: 1 };
  });
  return state;
}

register("publicState marks players with zero territories as eliminated", () => {
  const state = setupLiveState();
  const snapshot = publicState(state);
  const player = snapshot.players.find((entry) => entry.id === "p2");
  assert.equal(player.eliminated, true);
});

register("publicState keeps players with territories active", () => {
  const state = setupLiveState();
  const territoryId = getMapTerritories(state)[0].id;
  state.territories[territoryId].ownerId = "p2";
  const snapshot = publicState(state);
  const player = snapshot.players.find((entry) => entry.id === "p2");
  assert.equal(player.eliminated, false);
});

register("declareWinnerIfNeeded assigns victory when one active player remains", () => {
  const state = setupLiveState();
  const won = declareWinnerIfNeeded(state);
  assert.equal(won, true);
  assert.equal(state.winnerId, "p1");
  assert.equal(state.phase, "finished");
});

register("declareWinnerIfNeeded does not assign victory while more than one player owns territories", () => {
  const state = setupLiveState();
  state.territories[getMapTerritories(state)[0].id].ownerId = "p2";
  const won = declareWinnerIfNeeded(state);
  assert.equal(won, false);
  assert.equal(state.winnerId, null);
});


