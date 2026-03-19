function sortDescending(values) {
  return values.slice().sort((left, right) => right - left);
}

function rollDie(random = Math.random) {
  return Math.floor(random() * 6) + 1;
}

function rollCombatDice(count, random = Math.random) {
  const dice = [];
  for (let index = 0; index < count; index += 1) {
    dice.push(rollDie(random));
  }
  return sortDescending(dice);
}

function compareCombatDice(attackerRolls, defenderRolls, options = {}) {
  const defenderWinsTies = options.defenderWinsTies !== false;
  const sortedAttackerRolls = sortDescending(Array.isArray(attackerRolls) ? attackerRolls : []);
  const sortedDefenderRolls = sortDescending(Array.isArray(defenderRolls) ? defenderRolls : []);
  const comparisons = [];
  const pairCount = Math.min(sortedAttackerRolls.length, sortedDefenderRolls.length);

  for (let index = 0; index < pairCount; index += 1) {
    const attackDie = sortedAttackerRolls[index];
    const defendDie = sortedDefenderRolls[index];
    const winner = attackDie > defendDie || (!defenderWinsTies && attackDie === defendDie) ? "attacker" : "defender";

    comparisons.push({
      pair: index + 1,
      attackDie,
      defendDie,
      winner
    });
  }

  return {
    attackerRolls: sortedAttackerRolls,
    defenderRolls: sortedDefenderRolls,
    comparisons
  };
}

module.exports = {
  compareCombatDice,
  rollCombatDice
};
