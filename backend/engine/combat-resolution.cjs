const { validateAttackAttempt } = require("./attack-validation.cjs");
const { compareCombatDice, rollCombatDice } = require("./combat-dice.cjs");
const { getDiceRuleSet } = require("../../shared/dice.cjs");
const { secureRandom } = require("../random.cjs");
const { getStateCombatRule } = require("./runtime-config.cjs");


function invalidFromValidation(validation) {
  return {
    ok: false,
    code: validation.code,
    message: validation.message,
    details: validation.details,
    combat: null
  };
}

function resolveSingleAttackRoll(state, graph, playerId, fromTerritoryId, toTerritoryId, options = {}) {
  const validation = validateAttackAttempt(state, graph, playerId, fromTerritoryId, toTerritoryId);
  if (!validation.ok) {
    return invalidFromValidation(validation);
  }

  const attackerState = state.territories[fromTerritoryId];
  const defenderState = state.territories[toTerritoryId];
  const random = typeof options.random === "function" ? options.random : secureRandom;
  const diceRuleSet = options.diceRuleSet
    || (options.diceRuleSetId ? getDiceRuleSet(options.diceRuleSetId) : null)
    || getStateCombatRule(state);
  const attackerReserve = diceRuleSet.attackerMustLeaveOneArmyBehind ? 1 : 0;

  const maxAttackDice = Math.min(diceRuleSet.attackerMaxDice, attackerState.armies - attackerReserve);
  const maxDefendDice = Math.min(diceRuleSet.defenderMaxDice, defenderState.armies);

  const attackDiceCount = options.attackDice == null ? maxAttackDice : Number(options.attackDice);
  const defendDiceCount = options.defendDice == null ? maxDefendDice : Number(options.defendDice);

  if (!Number.isInteger(attackDiceCount) || attackDiceCount < 1 || attackDiceCount > maxAttackDice) {
    throw new Error(`Attacker dice must be between 1 and ${maxAttackDice}.`);
  }

  if (!Number.isInteger(defendDiceCount) || defendDiceCount < 1 || defendDiceCount > maxDefendDice) {
    throw new Error(`Defender dice must be between 1 and ${maxDefendDice}.`);
  }

  const { attackerRolls, defenderRolls, comparisons } = compareCombatDice(
    rollCombatDice(attackDiceCount, random),
    rollCombatDice(defendDiceCount, random),
    { defenderWinsTies: diceRuleSet.defenderWinsTies }
  );

  for (const comparison of comparisons) {
    if (comparison.winner === "attacker") {
      defenderState.armies -= 1;
    } else {
      attackerState.armies -= 1;
    }
  }

  return {
    ok: true,
    code: defenderState.armies <= 0 ? "DEFENDER_REDUCED_TO_ZERO" : "COMBAT_RESOLVED",
    message:
      defenderState.armies <= 0
        ? "Combat resolved and the defender territory has been reduced to zero armies."
        : "Combat resolved.",
    details: validation.details,
    combat: {
      fromTerritoryId,
      toTerritoryId,
      diceRuleSetId: diceRuleSet.id || "standard",
      attackDiceCount,
      defendDiceCount,
      attackerRolls,
      defenderRolls,
      comparisons,
      attackerArmiesRemaining: attackerState.armies,
      defenderArmiesRemaining: defenderState.armies,
      defenderReducedToZero: defenderState.armies <= 0
    }
  };
}

module.exports = {
  resolveSingleAttackRoll
};
