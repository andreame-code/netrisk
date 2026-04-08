const assert = require("node:assert/strict");
const { detectVictory } = require("../../../backend/engine/victory-detection.cjs");
const { createGameModeDefinition } = require("../../../shared/models.cjs");
const { makePlayers, makeState, territoryStates, TurnPhase } = require("../helpers/state-builder.cjs");

register("detectVictory declares objective victory for territory-control before elimination", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    gameModeDefinition: createGameModeDefinition({
      victoryRuleId: "territory-control",
      setupOptions: {
        targetTerritoryCount: 5
      }
    }),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 },
      { id: "c", ownerId: "p1", armies: 1 },
      { id: "d", ownerId: "p1", armies: 1 },
      { id: "e", ownerId: "p1", armies: 1 },
      { id: "f", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.code, "VICTORY_DECLARED");
  assert.equal(result.victory.winnerId, "p1");
  assert.equal(state.phase, "finished");
});
