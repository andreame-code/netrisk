const assert = require("node:assert/strict");
const { calculateReinforcements } = require("../../../backend/engine/reinforcement-calculator.cjs");
const { createGameModeDefinition } = require("../../../shared/models.cjs");
const { makePlayers, makeState, territoryStates } = require("../helpers/state-builder.cjs");

register("calculateReinforcements applies enabled rule module bonuses from game mode setup", () => {
  const players = makePlayers(["Alice", "Bob"]);
  const state = makeState({
    players,
    gameModeDefinition: createGameModeDefinition({
      enabledRuleModuleIds: ["reinforcement-bonus"],
      setupOptions: {
        extraReinforcementsPerTurn: 2
      }
    }),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 },
      { id: "c", ownerId: "p1", armies: 1 },
      { id: "d", ownerId: "p2", armies: 1 }
    ])
  });

  const result = calculateReinforcements(state, "p1");
  assert.equal(result.baseReinforcements, 3);
  assert.equal(result.totalReinforcements, 5);
  assert.equal(result.moduleBonuses.length, 1);
  assert.equal(result.moduleBonuses[0].ruleModuleId, "reinforcement-bonus");
});
