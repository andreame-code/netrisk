const assert = require("node:assert/strict");
const { createConfiguredInitialState } = require("../../../backend/new-game-config.cjs");

register("createConfiguredInitialState stores a complete gameModeDefinition in state and gameConfig", () => {
  const result = createConfiguredInitialState({
    mapId: "classic-mini",
    totalPlayers: 2,
    victoryRuleId: "territory-control",
    diceRuleSetId: "standard-3-defense",
    enabledRuleModuleIds: ["reinforcement-bonus"],
    setupOptions: {
      targetTerritoryCount: 5,
      extraReinforcementsPerTurn: 2
    },
    players: [
      { type: "human" },
      { type: "ai" }
    ]
  });

  assert.equal(result.state.gameModeDefinition.mapId, "classic-mini");
  assert.equal(result.state.gameModeDefinition.diceRuleSetId, "standard-3-defense");
  assert.equal(result.state.gameModeDefinition.victoryRuleId, "territory-control");
  assert.deepEqual(result.state.gameModeDefinition.enabledRuleModuleIds, ["reinforcement-bonus"]);
  assert.equal(result.state.gameConfig.gameModeDefinition.victoryRuleId, "territory-control");
  assert.equal(result.state.diceRuleSetId, "standard-3-defense");
});
