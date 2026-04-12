// @ts-nocheck
const assert = require("node:assert/strict");
const { detectVictory } = require("../../../backend/engine/victory-detection.cjs");
const { makePlayers, makeState, territoryStates, TurnPhase } = require("../helpers/state-builder.cjs");

register("detectVictory declares victory when only one active player remains", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.ok, true);
  assert.equal(result.code, "VICTORY_DECLARED");
  assert.equal(result.victory.winnerId, "p1");
  assert.equal(state.winnerId, "p1");
  assert.equal(state.phase, "finished");
  assert.equal(state.turnPhase, TurnPhase.FINISHED);
});

register("detectVictory returns no victory while multiple active players remain", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.ok, true);
  assert.equal(result.code, "NO_VICTORY");
  assert.equal(result.victory, null);
  assert.equal(state.winnerId, null);
});

register("detectVictory throws for impossible states with no active players", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: null, armies: 0 },
      { id: "b", ownerId: null, armies: 0 }
    ])
  });

  assert.throws(() => detectVictory(state), /no active players/i);
});

register("detectVictory ignores surrendered players even if they still own territories", () => {
  const players = makePlayers(["Alice", "Bob"]);
  players[1].surrendered = true;
  const state = makeState({
    players,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.code, "VICTORY_DECLARED");
  assert.equal(result.victory.winnerId, "p1");
});

register("detectVictory closes the game when only AI players remain active", () => {
  const players = makePlayers(["Alice", "Bot Alpha", "Bot Beta"]);
  players[1].isAi = true;
  players[2].isAi = true;
  players[0].surrendered = true;
  const state = makeState({
    players,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p2", armies: 1 },
      { id: "c", ownerId: "p3", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.code, "AI_ONLY_REMAIN");
  assert.equal(result.victory, null);
  assert.equal(state.winnerId, null);
  assert.equal(state.phase, "finished");
  assert.equal(state.turnPhase, TurnPhase.FINISHED);
});
