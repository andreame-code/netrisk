const assert = require("node:assert/strict");
const { createInitialGameState } = require("../../../backend/engine/game-setup.cjs");
const { calculateReinforcements } = require("../../../backend/engine/reinforcement-calculator.cjs");
const { placeReinforcement } = require("../../../backend/engine/reinforcement-placement.cjs");
const { resolveSingleAttackRoll } = require("../../../backend/engine/combat-resolution.cjs");
const { resolveConquest } = require("../../../backend/engine/conquest-resolution.cjs");
const { moveFortifyArmies } = require("../../../backend/engine/fortify-movement.cjs");
const { createFixedRandom, rollsToRandomValues } = require("../helpers/random.cjs");
const {
  makeGraph,
  makeMapDefinition,
  makePlayers,
  makeState,
  makeTerritory,
  territoryStates,
  TurnPhase
} = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("regression: setup to reinforcement placement keeps state coherent", () => {
  const players = makePlayers(["Alice", "Bob"]);
  const territories = [
    makeTerritory("a", ["b"]),
    makeTerritory("b", ["a"]),
    makeTerritory("c", []),
    makeTerritory("d", [])
  ];
  const state = createInitialGameState(makeMapDefinition(territories), players);
  const currentPlayer = state.players[state.currentTurnIndex];
  const reinforcements = calculateReinforcements(state, currentPlayer.id);
  state.reinforcementPool = reinforcements.totalReinforcements;

  const owned = Object.keys(state.territories).find(
    (territoryId: string) => state.territories[territoryId].ownerId === currentPlayer.id
  );
  if (!owned) {
    throw new Error("Expected the current player to own at least one territory.");
  }
  const placed = placeReinforcement(state, currentPlayer.id, owned);

  assert.equal(placed.remainingReinforcements, reinforcements.totalReinforcements - 1);
  assert.equal(state.territories[owned].armies, 2);
});

register("regression: attack to combat to conquest updates ownership and armies", () => {
  const territories = [makeTerritory("a", ["b"]), makeTerritory("b", ["a"])];
  const graph = makeGraph(territories);
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 4 },
      { id: "b", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK,
    currentTurnIndex: 0
  });

  const combat = resolveSingleAttackRoll(state, graph, "p1", "a", "b", {
    attackDice: 3,
    defendDice: 1,
    random: createFixedRandom(rollsToRandomValues([6, 5, 4, 1]))
  });
  const conquest = resolveConquest(state, combat, 3);

  assert.equal(combat.combat.defenderReducedToZero, true);
  assert.equal(conquest.ok, true);
  assert.equal(state.territories.b.ownerId, "p1");
  assert.equal(state.territories.b.armies, 3);
});

register("regression: fortify move updates end-of-turn board slice coherently", () => {
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
      { id: "b", ownerId: "p1", armies: 2 },
      { id: "c", ownerId: "p1", armies: 1 }
    ]),
    turnPhase: TurnPhase.FORTIFY,
    currentTurnIndex: 0,
    fortifyMoveUsed: false
  });

  const result = moveFortifyArmies(state, graph, "p1", "a", "c", 1);

  assert.equal(result.ok, true);
  assert.equal(state.territories.a.armies, 3);
  assert.equal(state.territories.c.armies, 2);
});
