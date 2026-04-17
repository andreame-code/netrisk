const { secureRandom } = require("../random.cjs");

export interface CombatComparison {
  pair: number;
  attackDie: number;
  defendDie: number;
  winner: "attacker" | "defender";
}

export interface CombatDiceComparison {
  attackerRolls: number[];
  defenderRolls: number[];
  comparisons: CombatComparison[];
}

interface CompareCombatDiceOptions {
  defenderWinsTies?: boolean;
}

function sortDescending(values: number[]): number[] {
  return values.slice().sort((left, right) => right - left);
}

function rollDie(random: () => number = secureRandom): number {
  return Math.floor(random() * 6) + 1;
}

export function rollCombatDice(count: number, random: () => number = secureRandom): number[] {
  const dice: number[] = [];
  for (let index = 0; index < count; index += 1) {
    dice.push(rollDie(random));
  }
  return sortDescending(dice);
}

export function compareCombatDice(
  attackerRolls: number[],
  defenderRolls: number[],
  options: CompareCombatDiceOptions = {}
): CombatDiceComparison {
  const defenderWinsTies = options.defenderWinsTies !== false;
  const sortedAttackerRolls = sortDescending(Array.isArray(attackerRolls) ? attackerRolls : []);
  const sortedDefenderRolls = sortDescending(Array.isArray(defenderRolls) ? defenderRolls : []);
  const comparisons: CombatComparison[] = [];
  const pairCount = Math.min(sortedAttackerRolls.length, sortedDefenderRolls.length);

  for (let index = 0; index < pairCount; index += 1) {
    const attackDie = sortedAttackerRolls[index] as number;
    const defendDie = sortedDefenderRolls[index] as number;
    const winner =
      attackDie > defendDie || (!defenderWinsTies && attackDie === defendDie)
        ? "attacker"
        : "defender";

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
