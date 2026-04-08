const assert = require("node:assert/strict");
const { createInitialGameState } = require("../../../backend/engine/game-setup.cjs");
const { createConfiguredInitialState } = require("../../../backend/new-game-config.cjs");
const { createEngineContentStore } = require("../../../backend/engine-content-store.cjs");
const { createDatastore } = require("../../../backend/datastore.cjs");
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

register("createConfiguredInitialState resolves a ruleset snapshot and keeps combat config immutable", async () => {
  const datastore = createDatastore({ dbFile: ":memory:" });
  const contentStore = createEngineContentStore({ datastore });

  const configured = await createConfiguredInitialState({
    name: "Ruleset Snapshot",
    rulesetId: "classic-three-defense",
    totalPlayers: 2,
    players: [{ type: "human" }, { type: "ai" }]
  }, { contentStore });

  assert.equal(configured.state.gameRulesetId, "classic-three-defense");
  assert.equal(configured.state.diceRuleSetId, "standard-3-defense");
  assert.equal(configured.state.resolvedGameConfig.combatRule.id, "standard-3-defense");
  assert.equal(configured.state.resolvedGameConfig.combatRule.defenderMaxDice, 3);
  assert.equal(configured.state.resolvedGameConfig.map.id, "classic-mini");
  assert.equal(configured.state.gameConfig.rulesetId, "classic-three-defense");
  assert.equal(configured.state.gameConfig.ruleModifierIds.includes("banzai-attack"), true);

  datastore.close();
});

