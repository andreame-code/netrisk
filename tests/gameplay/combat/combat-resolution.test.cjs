const assert = require("node:assert/strict");
const { resolveSingleAttackRoll } = require("../../../backend/engine/combat-resolution.cjs");
const { createFixedRandom, rollsToRandomValues } = require("../helpers/random.cjs");
const { makeGraph, makePlayers, makeState, makeTerritory, territoryStates, TurnPhase } = require("../helpers/state-builder.cjs");

function setupCombatState(attackerArmies = 4, defenderArmies = 2) {
  const territories = [makeTerritory("a", ["b"]), makeTerritory("b", ["a"])];
  return {
    graph: makeGraph(territories),
    state: makeState({
      players: makePlayers(["Alice", "Bob"]),
      territories: territoryStates([
        { id: "a", ownerId: "p1", armies: attackerArmies },
        { id: "b", ownerId: "p2", armies: defenderArmies }
      ]),
      turnPhase: TurnPhase.ATTACK,
      currentTurnIndex: 0
    })
  };
}

register("resolveSingleAttackRoll compares sorted dice correctly for multi-die combat", () => {
  const { graph, state } = setupCombatState(4, 2);
  const result = resolveSingleAttackRoll(state, graph, "p1", "a", "b", {
    attackDice: 3,
    defendDice: 2,
    random: createFixedRandom(rollsToRandomValues([6, 2, 5, 4, 1]))
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.combat.attackerRolls, [6, 5, 2]);
  assert.deepEqual(result.combat.defenderRolls, [4, 1]);
  assert.equal(result.combat.comparisons[0].winner, "attacker");
  assert.equal(result.combat.comparisons[1].winner, "attacker");
  assert.equal(result.combat.defenderReducedToZero, true);
});

register("resolveSingleAttackRoll lets defender win ties", () => {
  const { graph, state } = setupCombatState(3, 2);
  const result = resolveSingleAttackRoll(state, graph, "p1", "a", "b", {
    attackDice: 2,
    defendDice: 1,
    random: createFixedRandom(rollsToRandomValues([4, 1, 4]))
  });

  assert.equal(result.ok, true);
  assert.equal(result.combat.comparisons[0].winner, "defender");
  assert.equal(state.territories.a.armies, 2);
  assert.equal(state.territories.b.armies, 2);
});

register("resolveSingleAttackRoll supports one-die attacks", () => {
  const { graph, state } = setupCombatState(2, 1);
  const result = resolveSingleAttackRoll(state, graph, "p1", "a", "b", {
    attackDice: 1,
    defendDice: 1,
    random: createFixedRandom(rollsToRandomValues([6, 1]))
  });

  assert.equal(result.ok, true);
  assert.equal(result.combat.attackDiceCount, 1);
  assert.equal(result.combat.defendDiceCount, 1);
  assert.equal(result.combat.defenderReducedToZero, true);
});

