// @ts-nocheck
const assert = require("node:assert/strict");
const { resolveSingleAttackRoll } = require("../../../backend/engine/combat-resolution.cjs");
const { compareCombatDice, rollCombatDice } = require("../../../backend/engine/combat-dice.cjs");
const {
  DEFENSE_THREE_DICE_RULE_SET_ID,
  STANDARD_DICE_RULE_SET_ID,
  getDiceRuleSet,
  listDiceRuleSets
} = require("../../../shared/dice.cjs");
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

register("resolveSingleAttackRoll applica i limiti dadi dal rule set", () => {
  const { graph, state } = setupCombatState(4, 2);
  const result = resolveSingleAttackRoll(state, graph, "p1", "a", "b", {
    diceRuleSet: {
      id: "variant-test",
      attackerMaxDice: 2,
      defenderMaxDice: 1,
      attackerMustLeaveOneArmyBehind: true,
      defenderWinsTies: true
    },
    random: createFixedRandom(rollsToRandomValues([6, 3, 5]))
  });

  assert.equal(result.ok, true);
  assert.equal(result.combat.diceRuleSetId, "variant-test");
  assert.equal(result.combat.attackDiceCount, 2);
  assert.equal(result.combat.defendDiceCount, 1);
  assert.deepEqual(result.combat.attackerRolls, [6, 3]);
  assert.deepEqual(result.combat.defenderRolls, [5]);
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


register("standard dice rule set espone i limiti classici di combattimento", () => {
  const ruleSet = getDiceRuleSet();
  assert.equal(ruleSet.id, STANDARD_DICE_RULE_SET_ID);
  assert.equal(ruleSet.attackerMaxDice, 3);
  assert.equal(ruleSet.defenderMaxDice, 2);
  assert.equal(ruleSet.attackerMustLeaveOneArmyBehind, true);
  assert.equal(ruleSet.defenderWinsTies, true);
});

register("defense 3 dice rule set espone l'opzione difensiva estesa", () => {
  const ruleSet = getDiceRuleSet(DEFENSE_THREE_DICE_RULE_SET_ID);
  assert.equal(ruleSet.id, DEFENSE_THREE_DICE_RULE_SET_ID);
  assert.equal(ruleSet.attackerMaxDice, 3);
  assert.equal(ruleSet.defenderMaxDice, 3);

  const listedIds = listDiceRuleSets().map((entry) => entry.id);
  assert.equal(listedIds.includes(DEFENSE_THREE_DICE_RULE_SET_ID), true);
});

register("resolveSingleAttackRoll supporta fino a 3 dadi in difesa con il rule set esteso", () => {
  const { graph, state } = setupCombatState(5, 4);
  const result = resolveSingleAttackRoll(state, graph, "p1", "a", "b", {
    diceRuleSet: getDiceRuleSet(DEFENSE_THREE_DICE_RULE_SET_ID),
    attackDice: 3,
    defendDice: 3,
    random: createFixedRandom(rollsToRandomValues([6, 5, 1, 4, 3, 2]))
  });

  assert.equal(result.ok, true);
  assert.equal(result.combat.diceRuleSetId, DEFENSE_THREE_DICE_RULE_SET_ID);
  assert.equal(result.combat.attackDiceCount, 3);
  assert.equal(result.combat.defendDiceCount, 3);
  assert.deepEqual(result.combat.attackerRolls, [6, 5, 1]);
  assert.deepEqual(result.combat.defenderRolls, [4, 3, 2]);
});

register("combat dice helpers tirano ordinato e confrontano in modo puro", () => {
  const rolls = rollCombatDice(3, createFixedRandom(rollsToRandomValues([2, 6, 4])));
  assert.deepEqual(rolls, [6, 4, 2]);

  const compared = compareCombatDice([2, 6, 4], [5, 1], { defenderWinsTies: true });
  assert.deepEqual(compared.attackerRolls, [6, 4, 2]);
  assert.deepEqual(compared.defenderRolls, [5, 1]);
  assert.deepEqual(compared.comparisons.map((entry) => entry.winner), ["attacker", "attacker"]);
});

