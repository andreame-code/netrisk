const assert = require("node:assert/strict");
const { placeReinforcement } = require("../../../backend/engine/reinforcement-placement.cjs");
const {
  makePlayers,
  makeState,
  territoryStates,
  TurnPhase
} = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

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
  assert.deepEqual(state.lastAction, {
    type: "reinforce",
    playerId: "p1",
    territoryId: "a",
    summary: "Alice places 1 reinforcement on a."
  });
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

register("placeReinforcement fails while the game is not active", () => {
  const state = makeState({
    phase: "lobby",
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "a", ownerId: "p1", armies: 2 }]),
    currentTurnIndex: 0,
    reinforcementPool: 1,
    turnPhase: TurnPhase.REINFORCEMENT
  });

  assert.throws(() => placeReinforcement(state, "p1", "a"), /game is active/i);
});

register("placeReinforcement fails when the acting player is not the current turn player", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "a", ownerId: "p1", armies: 2 }]),
    currentTurnIndex: 1,
    reinforcementPool: 1,
    turnPhase: TurnPhase.REINFORCEMENT
  });

  assert.throws(() => placeReinforcement(state, "p1", "a"), /current player/i);
});

register("placeReinforcement fails when no reinforcements remain", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "a", ownerId: "p1", armies: 2 }]),
    currentTurnIndex: 0,
    reinforcementPool: 0,
    turnPhase: TurnPhase.REINFORCEMENT
  });

  assert.throws(() => placeReinforcement(state, "p1", "a"), /No reinforcements/i);
});

register("placeReinforcement fails when the player id is missing", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "a", ownerId: "p1", armies: 2 }]),
    currentTurnIndex: 0,
    reinforcementPool: 1,
    turnPhase: TurnPhase.REINFORCEMENT
  });

  assert.throws(() => placeReinforcement(state, "", "a"), /player id/i);
});

register("placeReinforcement fails for unknown territories", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "a", ownerId: "p1", armies: 2 }]),
    currentTurnIndex: 0,
    reinforcementPool: 1,
    turnPhase: TurnPhase.REINFORCEMENT
  });

  assert.throws(() => placeReinforcement(state, "p1", "missing"), /Unknown territory/i);
});

register("placeReinforcement fails when the territory id is missing", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "a", ownerId: "p1", armies: 2 }]),
    currentTurnIndex: 0,
    reinforcementPool: 1,
    turnPhase: TurnPhase.REINFORCEMENT
  });

  assert.throws(() => placeReinforcement(state, "p1", ""), /territory id/i);
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
