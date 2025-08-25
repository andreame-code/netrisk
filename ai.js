// AI utility functions for decision making

// Estimate probability of successful attack based on army counts.
// Uses a simple heuristic: proportion of attacking armies (minus one) over total armies involved.
function successProbability(from, to) {
  const attackers = from.armies - 1;
  const defenders = to.armies;
  if (attackers <= 0) return 0;
  return attackers / (attackers + defenders);
}

// Determine priority of reinforcing a territory based on number of enemy neighbors.
function territoryPriority(game, territory) {
  const enemyNeighbors = territory.neighbors.filter(id => {
    const n = game.territoryById(id);
    return n.owner !== territory.owner;
  }).length;
  return enemyNeighbors;
}

// Choose the best territory to reinforce for the current player.
function chooseReinforcement(game) {
  const owned = game.territories.filter(t => t.owner === game.currentPlayer);
  let best = null;
  owned.forEach(t => {
    const score = territoryPriority(game, t);
    if (!best || score > best.score) {
      best = { territory: t, score };
    }
  });
  return best ? best.territory : null;
}

// Choose the most promising attack based on success probability.
function chooseAttack(game) {
  let best = null;
  game.territories
    .filter(t => t.owner === game.currentPlayer && t.armies > 1)
    .forEach(from => {
      from.neighbors.forEach(id => {
        const to = game.territoryById(id);
        if (to.owner !== game.currentPlayer) {
          const prob = successProbability(from, to);
          if (!best || prob > best.prob) {
            best = { from, to, prob };
          }
        }
      });
    });
  return best;
}

// Choose a fortification move to balance armies across friendly territories.
function chooseFortification(game) {
  let best = null;
  game.territories
    .filter(t => t.owner === game.currentPlayer && t.armies > 1)
    .forEach(from => {
      from.neighbors.forEach(id => {
        const to = game.territoryById(id);
        if (to.owner === game.currentPlayer) {
          const diff = from.armies - to.armies;
          if (diff > 1 && (!best || diff > best.diff)) {
            best = { from, to, diff };
          }
        }
      });
    });
  return best;
}

// Find a valid set of cards to play (three of a kind or all different types).
function findValidCardSet(hand) {
  if (!hand || hand.length < 3) return null;
  for (let i = 0; i < hand.length - 2; i++) {
    for (let j = i + 1; j < hand.length - 1; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const types = [hand[i].type, hand[j].type, hand[k].type];
        const allSame = types[0] === types[1] && types[1] === types[2];
        const allDiff = new Set(types).size === 3;
        if (allSame || allDiff) return [i, j, k];
      }
    }
  }
  return null;
}

module.exports = {
  successProbability,
  territoryPriority,
  chooseReinforcement,
  chooseAttack,
  chooseFortification,
  findValidCardSet,
};

