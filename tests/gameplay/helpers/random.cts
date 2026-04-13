function createFixedRandom(sequence: number[]): () => number {
  const values = Array.isArray(sequence) ? sequence.slice() : [];
  let index = 0;

  return function fixedRandom() {
    if (index >= values.length) {
      throw new Error("Fixed random sequence exhausted.");
    }

    const value = values[index];
    index += 1;
    return value;
  };
}

function rollsToRandomValues(rolls: number[]): number[] {
  return rolls.map((roll) => {
    if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
      throw new Error("Dice rolls must be integers between 1 and 6.");
    }

    return (roll - 0.01) / 6;
  });
}

module.exports = {
  createFixedRandom,
  rollsToRandomValues
};
