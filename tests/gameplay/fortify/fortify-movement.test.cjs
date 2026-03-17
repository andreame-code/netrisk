const assert = require("node:assert/strict");
const { moveFortifyArmies } = require("../../../backend/engine/fortify-movement.cjs");
const { makeGraph, makePlayers, makeState, makeTerritory, territoryStates, TurnPhase } = require("../helpers/state-builder.cjs");

function setupFortifyState() {
  const territories = [
    makeTerritory("a", ["b"]),
    makeTerritory("b", ["a", "c"]),
    makeTerritory("c", ["b"])
  ];

  return {
    graph: makeGraph(territories),
    state: makeState({
      players: makePlayers(["Alice", "Bob"]),
      territories: territoryStates([
        { id: "a", ownerId: "p1", armies: 4 },
        { id: "b", ownerId: "p1", armies: 2 },
        { id: "c", ownerId: "p1", armies: 1 }
      ]),
      turnPhase: TurnPhase.FORTIFY,
      currentTurnIndex: 0,
      fortifyMoveUsed: false
    })
  };
}

register("moveFortifyArmies moves armies along a valid owned path", () => {
  const { graph, state } = setupFortifyState();
  const result = moveFortifyArmies(state, graph, "p1", "a", "c", 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.fortify.path, ["a", "b", "c"]);
  assert.equal(state.territories.a.armies, 2);
  assert.equal(state.territories.c.armies, 3);
});

register("moveFortifyArmies fails outside fortify phase", () => {
  const { graph, state } = setupFortifyState();
  state.turnPhase = TurnPhase.ATTACK;
  const result = moveFortifyArmies(state, graph, "p1", "a", "c", 1);
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_PHASE");
});

register("moveFortifyArmies fails without a connected owned path", () => {
  const territories = [
    makeTerritory("a", ["b"]),
    makeTerritory("b", ["a", "c"]),
    makeTerritory("c", ["b"])
  ];
  const graph = makeGraph(territories);
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 4 },
      { id: "b", ownerId: "p2", armies: 2 },
      { id: "c", ownerId: "p1", armies: 1 }
    ]),
    turnPhase: TurnPhase.FORTIFY,
    currentTurnIndex: 0,
    fortifyMoveUsed: false
  });

  const result = moveFortifyArmies(state, graph, "p1", "a", "c", 1);
  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_OWNED_PATH");
});

register("moveFortifyArmies blocks a repeated fortify in the same turn", () => {
  const { graph, state } = setupFortifyState();
  state.fortifyMoveUsed = true;
  const result = moveFortifyArmies(state, graph, "p1", "a", "b", 1);
  assert.equal(result.ok, false);
  assert.equal(result.code, "FORTIFY_ALREADY_USED");
});

