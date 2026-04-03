const assert = require("node:assert/strict");
const { validateAttackAttempt } = require("../../../backend/engine/attack-validation.cjs");
const { makeGraph, makePlayers, makeState, makeTerritory, territoryStates, TurnPhase } = require("../helpers/state-builder.cjs");

function setupValidationState() {
  const territories = [
    makeTerritory("a", ["b"]),
    makeTerritory("b", ["a", "c"]),
    makeTerritory("c", ["b"])
  ];
  const graph = makeGraph(territories);
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 3 },
      { id: "b", ownerId: "p2", armies: 2 },
      { id: "c", ownerId: "p1", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK,
    currentTurnIndex: 0
  });

  return { graph, state };
}

register("validateAttackAttempt allows a valid adjacent enemy attack", () => {
  const { graph, state } = setupValidationState();
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, true);
  assert.equal(result.code, "ATTACK_ALLOWED");
});

register("validateAttackAttempt rejects attacks outside attack phase", () => {
  const { graph, state } = setupValidationState();
  state.turnPhase = TurnPhase.REINFORCEMENT;
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_PHASE");
});

register("validateAttackAttempt rejects non-enemy defender territories", () => {
  const { graph, state } = setupValidationState();
  const result = validateAttackAttempt(state, graph, "p1", "a", "c");
  assert.equal(result.ok, false);
  assert.equal(result.code, "DEFENDER_NOT_ENEMY");
});

register("validateAttackAttempt rejects non-adjacent territories", () => {
  const territories = [
    makeTerritory("a", ["b"]),
    makeTerritory("b", ["a"]),
    makeTerritory("c", [])
  ];
  const graph = makeGraph(territories);
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 3 },
      { id: "b", ownerId: "p1", armies: 2 },
      { id: "c", ownerId: "p2", armies: 2 }
    ]),
    turnPhase: TurnPhase.ATTACK,
    currentTurnIndex: 0
  });

  const result = validateAttackAttempt(state, graph, "p1", "a", "c");
  assert.equal(result.ok, false);
  assert.equal(result.code, "NOT_ADJACENT");
});

register("validateAttackAttempt rejects attacker territories with fewer than two armies", () => {
  const { graph, state } = setupValidationState();
  state.territories.a.armies = 1;
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "INSUFFICIENT_ARMIES");
});

