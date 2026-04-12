// @ts-nocheck
const assert = require("node:assert/strict");
const { createInitialGameState } = require("../../../backend/engine/game-setup.cjs");
const { makeMapDefinition, makePlayers, makeTerritory } = require("../helpers/state-builder.cjs");

register("createInitialGameState assigns all territories with owners and one army", () => {
  const players = makePlayers(["Alice", "Bob", "Cara"]);
  const territories = [
    makeTerritory("alpha", ["beta"]),
    makeTerritory("beta", ["alpha", "gamma"]),
    makeTerritory("gamma", ["beta", "delta"]),
    makeTerritory("delta", ["gamma"])
  ];

  const state = createInitialGameState(makeMapDefinition(territories), players);

  assert.equal(state.phase, "active");
  assert.equal(state.turnPhase, "reinforcement");
  assert.equal(state.currentTurnIndex, 0);
  assert.equal(state.turnNumber, 1);
  assert.equal(Object.keys(state.territories).length, territories.length);

  territories.forEach((territory) => {
    assert.ok(state.territories[territory.id]);
    assert.ok(state.territories[territory.id].ownerId);
    assert.equal(state.territories[territory.id].armies, 1);
  });
});

register("createInitialGameState rejects empty player lists", () => {
  const territories = [makeTerritory("alpha", [])];
  assert.throws(() => createInitialGameState(makeMapDefinition(territories), []), /at least one player/i);
});

register("createInitialGameState rejects empty maps", () => {
  const players = makePlayers(["Alice", "Bob"]);
  assert.throws(() => createInitialGameState({ territories: [] }, players), /at least one territory/i);
});

register("createInitialGameState rejects duplicate player ids", () => {
  const players = [
    { id: "p1", name: "Alice" },
    { id: "p1", name: "Bob" }
  ];
  const territories = [makeTerritory("alpha", [])];

  assert.throws(() => createInitialGameState(makeMapDefinition(territories), players), /duplicate player id/i);
});

