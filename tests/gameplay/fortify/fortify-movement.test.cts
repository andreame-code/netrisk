const assert = require("node:assert/strict");
const { moveFortifyArmies } = require("../../../backend/engine/fortify-movement.cjs");
const {
  makeGraph,
  makePlayers,
  makeState,
  makeTerritory,
  territoryStates,
  TurnPhase
} = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

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

register("moveFortifyArmies rejects invalid state and graph inputs", () => {
  const { graph, state } = setupFortifyState();

  assert.throws(() => moveFortifyArmies(null, graph, "p1", "a", "c", 1), /valid game state/);
  assert.throws(() => moveFortifyArmies(state, {}, "p1", "a", "c", 1), /valid map graph/);
  assert.throws(() => moveFortifyArmies(state, graph, "", "a", "c", 1), /requires player/);
});

register("moveFortifyArmies rejects non-active games and non-current players", () => {
  const { graph, state } = setupFortifyState();

  state.phase = "lobby";
  const inactive = moveFortifyArmies(state, graph, "p1", "a", "c", 1);
  assert.equal(inactive.ok, false);
  assert.equal(inactive.code, "GAME_NOT_ACTIVE");

  state.phase = "active";
  state.currentTurnIndex = 1;
  const wrongPlayer = moveFortifyArmies(state, graph, "p1", "a", "c", 1);
  assert.equal(wrongPlayer.ok, false);
  assert.equal(wrongPlayer.code, "NOT_CURRENT_PLAYER");
  assert.deepEqual(wrongPlayer.details, { currentPlayerId: "p2" });
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

register("moveFortifyArmies allows repeated moves when single-move enforcement is disabled", () => {
  const { graph, state } = setupFortifyState();
  state.fortifyMoveUsed = true;

  const result = moveFortifyArmies(state, graph, "p1", "a", "b", 1, {
    enforceSingleMove: false
  });

  assert.equal(result.ok, true);
  assert.equal(result.fortify.fortifyMoveUsed, true);
  assert.equal(state.territories.a.armies, 3);
  assert.equal(state.territories.b.armies, 3);
});

register("moveFortifyArmies rejects moves within the same territory", () => {
  const { graph, state } = setupFortifyState();
  const result = moveFortifyArmies(state, graph, "p1", "a", "a", 1);

  assert.equal(result.ok, false);
  assert.equal(result.code, "SAME_TERRITORY");
});

register("moveFortifyArmies validates territory existence and ownership before moving", () => {
  const { graph, state } = setupFortifyState();

  const unknownSource = moveFortifyArmies(state, graph, "p1", "missing", "c", 1);
  assert.equal(unknownSource.ok, false);
  assert.equal(unknownSource.code, "UNKNOWN_SOURCE_TERRITORY");

  const unknownTarget = moveFortifyArmies(state, graph, "p1", "a", "missing", 1);
  assert.equal(unknownTarget.ok, false);
  assert.equal(unknownTarget.code, "UNKNOWN_TARGET_TERRITORY");

  delete state.territories.c;
  const missingState = moveFortifyArmies(state, graph, "p1", "a", "c", 1);
  assert.equal(missingState.ok, false);
  assert.equal(missingState.code, "MISSING_TERRITORY_STATE");

  state.territories.c = { ownerId: "p2", armies: 1 };
  const notOwned = moveFortifyArmies(state, graph, "p1", "a", "c", 1);
  assert.equal(notOwned.ok, false);
  assert.equal(notOwned.code, "TERRITORY_NOT_OWNED");
  assert.deepEqual(notOwned.details, { fromOwnerId: "p1", toOwnerId: "p2" });
});

register("moveFortifyArmies validates whole army counts and source capacity", () => {
  const { graph, state } = setupFortifyState();

  const fractional = moveFortifyArmies(state, graph, "p1", "a", "c", 1.5);
  assert.equal(fractional.ok, false);
  assert.equal(fractional.code, "INVALID_ARMY_COUNT");

  const zero = moveFortifyArmies(state, graph, "p1", "a", "c", 0);
  assert.equal(zero.ok, false);
  assert.equal(zero.code, "INVALID_ARMY_COUNT");

  state.territories.a.armies = 1;
  const insufficient = moveFortifyArmies(state, graph, "p1", "a", "c", 1);
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.code, "INSUFFICIENT_SOURCE_ARMIES");

  state.territories.a.armies = 4;
  const tooMany = moveFortifyArmies(state, graph, "p1", "a", "c", 4);
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.code, "MOVE_EXCEEDS_AVAILABLE");
  assert.deepEqual(tooMany.details, {
    maxMove: 3,
    requestedArmies: 4,
    sourceArmies: 4
  });
});

register("moveFortifyArmies applica il minimo modulare durante la fortifica", () => {
  const { graph, state } = setupFortifyState();
  state.gameConfig = {
    gameplayEffects: {
      fortifyMinimumArmies: 2
    }
  };

  const blocked = moveFortifyArmies(state, graph, "p1", "a", "c", 1);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "MOVE_BELOW_MINIMUM");

  const allowed = moveFortifyArmies(state, graph, "p1", "a", "c", 2);
  assert.equal(allowed.ok, true);
  assert.equal(state.territories.a.armies, 2);
  assert.equal(state.territories.c.armies, 3);
});
