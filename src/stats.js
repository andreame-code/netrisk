import { REINFORCE } from "./phases.js";

const stats = {
  startTime: 0,
  territories: [],
  armies: [],
  attacksWon: [],
  attacksLost: [],
};

function recordTurn(game) {
  game.players.forEach((_, idx) => {
    const count = game.territories.filter((t) => t.owner === idx).length;
    stats.territories[idx].push(count);
    stats.armies[idx].push(0);
    stats.attacksWon[idx].push(0);
    stats.attacksLost[idx].push(0);
  });
}

function attachStatsListeners(game) {
  stats.startTime = Date.now();
  stats.territories = game.players.map(() => []);
  stats.armies = game.players.map(() => []);
  stats.attacksWon = game.players.map(() => []);
  stats.attacksLost = game.players.map(() => []);
  recordTurn(game);
  game.on("turnStart", () => {
    recordTurn(game);
  });
  game.on(REINFORCE, ({ player }) => {
    const i = stats.armies[player].length - 1;
    if (i >= 0) stats.armies[player][i] += 1;
  });
  game.on("attackResolved", ({ result }) => {
    const player = game.currentPlayer;
    const i = stats.attacksWon[player].length - 1;
    if (result.conquered) stats.attacksWon[player][i] += 1;
    else stats.attacksLost[player][i] += 1;
  });
}

function getStats() {
  return stats;
}

function exportStats() {
  const { startTime, territories, armies, attacksWon, attacksLost } = stats;
  return JSON.stringify({
    startTime,
    territories,
    armies,
    attacksWon,
    attacksLost,
  });
}

export { attachStatsListeners, getStats, exportStats };
