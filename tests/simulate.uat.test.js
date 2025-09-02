import Game from '../src/game.js';
import aiTurnManager from '../src/game/ai/turn-manager.js';
import { GAME_OVER } from '../src/phases.js';

const mapMock = {
  territories: [
    { id: 't1', neighbors: ['t2', 't4'], x: 120, y: 100 },
    { id: 't2', neighbors: ['t1', 't3', 't5'], x: 340, y: 110 },
    { id: 't3', neighbors: ['t2', 't6'], x: 500, y: 140 },
    { id: 't4', neighbors: ['t1', 't5'], x: 150, y: 260 },
    { id: 't5', neighbors: ['t2', 't4', 't6'], x: 360, y: 220 },
    { id: 't6', neighbors: ['t3', 't5'], x: 520, y: 300 },
  ],
  continents: [
    { name: 'north', territories: ['t1', 't2', 't3'], bonus: 2 },
    { name: 'south', territories: ['t4', 't5', 't6'], bonus: 2 },
  ],
  deck: [
    { territory: 't1', type: 'infantry' },
    { territory: 't2', type: 'cavalry' },
    { territory: 't3', type: 'artillery' },
    { territory: 't4', type: 'infantry' },
    { territory: 't5', type: 'cavalry' },
    { territory: 't6', type: 'artillery' },
  ],
};

async function runSimulations(count = 100) {
  const wins = [0, 0];
  const profile = { difficulty: 'normal', style: 'balanced' };
  for (let i = 0; i < count; i++) {
    const players = [
      { name: 'AI 1', color: '#f00', ai: true, ...profile },
      { name: 'AI 2', color: '#0f0', ai: true, ...profile },
    ];
    const g = await Game.create(players, mapMock.territories, mapMock.continents, mapMock.deck);
    aiTurnManager(g);
    while (g.phase !== GAME_OVER) {
      g.performAITurn();
    }
    const winner = g.checkVictory();
    if (winner !== null) {
      wins[winner] += 1;
    }
  }
  return wins;
}

test('aggregates results across multiple simulations', async () => {
  const runs = 5;
  const results = await runSimulations(runs);
  expect(results).toHaveLength(2);
  expect(results[0] + results[1]).toBe(runs);
  expect(results.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
});

test('handles zero simulations', async () => {
  const results = await runSimulations(0);
  expect(results).toEqual([0, 0]);
});
