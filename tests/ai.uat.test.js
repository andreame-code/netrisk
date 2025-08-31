import { battleOutcomeProbs, territoryPriority } from '../src/game/index.js';

class MockGame {
  constructor(map) {
    this.map = map;
  }
  territoryById(id) {
    return this.map[id];
  }
}

describe('battleOutcomeProbs', () => {
  test('probabilities sum to 1', () => {
    const outcomes = battleOutcomeProbs(3, 2);
    const total = outcomes.reduce((sum, o) => sum + o.prob, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  test('memoizes results for dice combinations', () => {
    const first = battleOutcomeProbs(3, 2);
    const second = battleOutcomeProbs(3, 2);
    expect(second).toBe(first);
  });
});

describe('territoryPriority', () => {
  test('applies profile styles to scoring', () => {
    const map = {
      b: { owner: 1 },
      c: { owner: 2 },
      d: { owner: 0 }
    };
    const game = new MockGame(map);
    const territory = { id: 'a', owner: 0, neighbors: ['b', 'c', 'd'], armies: 5 };

    const base = territoryPriority(game, territory);
    const aggressive = territoryPriority(game, territory, { style: 'aggressive' });
    const defensive = territoryPriority(game, territory, { style: 'defensive' });

    expect(base).toBe(15);
    expect(aggressive).toBe(20);
    expect(defensive).toBe(10);
  });
});

