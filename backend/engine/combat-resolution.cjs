const { validateAttackAttempt } = require("./attack-validation.cjs");

function rollDie(random) {
  return Math.floor(random() * 6) + 1;
}

function sortDescending(values) {
  return values.slice().sort((left, right) => right - left);
}

function buildDice(count, random) {
  const dice = [];
  for (let index = 0; index < count; index += 1) {
    dice.push(rollDie(random));
  }
  return sortDescending(dice);
}

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
  const random = typeof options.random === "function" ? options.random : Math.random;

  const maxAttackDice = Math.min(3, attackerState.armies - 1);
  const maxDefendDice = Math.min(2, defenderState.armies);

  const attackDiceCount = options.attackDice == null ? maxAttackDice : Number(options.attackDice);
  const defendDiceCount = options.defendDice == null ? maxDefendDice : Number(options.defendDice);

  if (!Number.isInteger(attackDiceCount) || attackDiceCount < 1 || attackDiceCount > maxAttackDice) {
    throw new Error(`Attacker dice must be between 1 and ${maxAttackDice}.`);
  }

  if (!Number.isInteger(defendDiceCount) || defendDiceCount < 1 || defendDiceCount > maxDefendDice) {
    throw new Error(`Defender dice must be between 1 and ${maxDefendDice}.`);
  }

  const attackerRolls = buildDice(attackDiceCount, random);
  const defenderRolls = buildDice(defendDiceCount, random);
  const comparisons = [];

  const pairCount = Math.min(attackerRolls.length, defenderRolls.length);
  for (let index = 0; index < pairCount; index += 1) {
    const attackDie = attackerRolls[index];
    const defendDie = defenderRolls[index];
    const winner = attackDie > defendDie ? "attacker" : "defender";

    comparisons.push({
      pair: index + 1,
      attackDie,
      defendDie,
      winner
    });

    if (winner === "attacker") {
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
