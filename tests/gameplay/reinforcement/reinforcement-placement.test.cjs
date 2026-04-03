const assert = require("node:assert/strict");
const { placeReinforcement } = require("../../../backend/engine/reinforcement-placement.cjs");
const { makePlayers, makeState, territoryStates, TurnPhase } = require("../helpers/state-builder.cjs");

register("placeReinforcement adds one army and decreases the pool on owned territory", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 2 },
      { id: "b", ownerId: "p2", armies: 1 }
    ]),
    currentTurnIndex: 0,
    reinforcementPool: 3,
    turnPhase: TurnPhase.REINFORCEMENT
  });

  const result = placeReinforcement(state, "p1", "a");
  assert.equal(result.remainingReinforcements, 2);
  assert.equal(state.territories.a.armies, 3);
  assert.equal(state.reinforcementPool, 2);
});

register("placeReinforcement fails outside the reinforcement phase", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "a", ownerId: "p1", armies: 2 }]),
    currentTurnIndex: 0,
    reinforcementPool: 1,
    turnPhase: TurnPhase.ATTACK
  });

  assert.throws(() => placeReinforcement(state, "p1", "a"), /reinforcement phase/i);
});

register("placeReinforcement fails on territories not owned by the current player", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "a", ownerId: "p2", armies: 2 }]),
    currentTurnIndex: 0,
    reinforcementPool: 1,
    turnPhase: TurnPhase.REINFORCEMENT
  });

  assert.throws(() => placeReinforcement(state, "p1", "a"), /owned territories/i);
});

