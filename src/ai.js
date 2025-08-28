const battleCache = {};

function enumerateRolls(dice) {
  const rolls = [];
  const recur = (arr, depth) => {
    if (depth === dice) {
      rolls.push([...arr]);
      return;
    }
    for (let i = 1; i <= 6; i++) {
      arr[depth] = i;
      recur(arr, depth + 1);
    }
  };
  recur([], 0);
  return rolls;
}

export function battleOutcomeProbs(attDice, defDice) {
  const key = `${attDice}v${defDice}`;
  if (battleCache[key]) return battleCache[key];
  const aRolls = enumerateRolls(attDice);
  const dRolls = enumerateRolls(defDice);
  const outcomes = {};
  for (const a of aRolls) {
    const aSorted = [...a].sort((x, y) => y - x);
    for (const d of dRolls) {
      const dSorted = [...d].sort((x, y) => y - x);
      const comparisons = Math.min(attDice, defDice);
      let attLoss = 0;
      let defLoss = 0;
      for (let i = 0; i < comparisons; i++) {
        if (aSorted[i] > dSorted[i]) defLoss++;
        else attLoss++;
      }
      const outcomeKey = `${attLoss}-${defLoss}`;
      outcomes[outcomeKey] = (outcomes[outcomeKey] || 0) + 1;
    }
  }
  const total = Math.pow(6, attDice + defDice);
  const result = Object.entries(outcomes).map(([k, count]) => {
    const [attLoss, defLoss] = k.split('-').map(Number);
    return { attLoss, defLoss, prob: count / total };
  });
  battleCache[key] = result;
  return result;
}

export function attackSuccessProbability(from, to) {
  const attack = from.armies - 1;
  const defend = to.armies;
  if (attack <= 0) return 0;

  const memo = new Map();
  const winProb = (att, def) => {
    if (def <= 0) return 1;
    if (att <= 0) return 0;
    const key = `${att},${def}`;
    if (memo.has(key)) return memo.get(key);
    const attDice = Math.min(3, att);
    const defDice = Math.min(2, def);
    let prob = 0;
    for (const outcome of battleOutcomeProbs(attDice, defDice)) {
      prob +=
        outcome.prob * winProb(att - outcome.attLoss, def - outcome.defLoss);
    }
    memo.set(key, prob);
    return prob;
  };

  return winProb(attack, defend);
}

export function territoryPriority(game, territory, profile = {}) {
  const enemyNeighbors = territory.neighbors.filter(id => {
    const neighbor = game.territoryById(id);
    return neighbor && neighbor.owner !== territory.owner;
  }).length;
  let score = enemyNeighbors * 10 - territory.armies;
  if (profile.style === "aggressive") score += territory.armies;
  if (profile.style === "defensive") score -= territory.armies;
  return score;
}

