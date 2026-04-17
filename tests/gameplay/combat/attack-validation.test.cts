const assert = require("node:assert/strict");
const { validateAttackAttempt } = require("../../../backend/engine/attack-validation.cjs");
const {
  makeGraph,
  makePlayers,
  makeState,
  makeTerritory,
  territoryStates,
  TurnPhase
} = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

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

register("validateAttackAttempt rejects attacks while the game is not active", () => {
  const { graph, state } = setupValidationState();
  state.phase = "lobby";
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "GAME_NOT_ACTIVE");
});

register("validateAttackAttempt rejects attackers that are not the current player", () => {
  const { graph, state } = setupValidationState();
  state.currentTurnIndex = 1;
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "NOT_CURRENT_PLAYER");
  assert.deepEqual(result.details, { currentPlayerId: "p2" });
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

register("validateAttackAttempt rejects unknown attacker territories from the graph", () => {
  const { graph, state } = setupValidationState();
  const result = validateAttackAttempt(state, graph, "p1", "missing", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNKNOWN_ATTACKER_TERRITORY");
});

register("validateAttackAttempt rejects unknown defender territories from the graph", () => {
  const { graph, state } = setupValidationState();
  const result = validateAttackAttempt(state, graph, "p1", "a", "missing");
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNKNOWN_DEFENDER_TERRITORY");
});

register("validateAttackAttempt rejects missing attacker territory state", () => {
  const { graph, state } = setupValidationState();
  delete state.territories.a;
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_ATTACKER_STATE");
});

register("validateAttackAttempt rejects missing defender territory state", () => {
  const { graph, state } = setupValidationState();
  delete state.territories.b;
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_DEFENDER_STATE");
});

register(
  "validateAttackAttempt rejects attacker territories not owned by the current player",
  () => {
    const { graph, state } = setupValidationState();
    state.territories.a.ownerId = "p2";
    const result = validateAttackAttempt(state, graph, "p1", "a", "b");
    assert.equal(result.ok, false);
    assert.equal(result.code, "ATTACKER_NOT_OWNED");
    assert.deepEqual(result.details, { ownerId: "p2" });
  }
);

register("validateAttackAttempt rejects attacker territories with fewer than two armies", () => {
  const { graph, state } = setupValidationState();
  state.territories.a.armies = 1;
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "INSUFFICIENT_ARMIES");
});

register("validateAttackAttempt applica il minimo modulare sul territorio attaccante", () => {
  const { graph, state } = setupValidationState();
  state.gameConfig = {
    gameplayEffects: {
      attackMinimumArmies: 4
    }
  };

  const blocked = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "INSUFFICIENT_ARMIES");
  assert.deepEqual(blocked.details, {
    armies: 3,
    minimumArmies: 4
  });

  state.territories.a.armies = 4;
  const allowed = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(allowed.ok, true);
});

register("validateAttackAttempt blocca nuovi attacchi quando il limite turno e raggiunto", () => {
  const { graph, state } = setupValidationState();
  state.attacksThisTurn = 1;
  state.gameConfig = {
    gameplayEffects: {
      attackLimitPerTurn: 1
    }
  };

  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "ATTACK_LIMIT_REACHED");
  assert.deepEqual(result.details, {
    attackLimitPerTurn: 1,
    attacksThisTurn: 1
  });
});

register("validateAttackAttempt rejects defenders without an enemy owner", () => {
  const { graph, state } = setupValidationState();
  state.territories.b.ownerId = null;
  const result = validateAttackAttempt(state, graph, "p1", "a", "b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "DEFENDER_NOT_ENEMY");
  assert.deepEqual(result.details, { ownerId: null });
});
