const { attackSuccessProbability, territoryPriority } = require('./ai');

class MockGame {
  constructor(map) { this.map = map; }
  territoryById(id) { return this.map[id]; }
}

test('attackSuccessProbability favors larger armies', () => {
  const high = attackSuccessProbability({ armies: 5 }, { armies: 1 });
  const low = attackSuccessProbability({ armies: 3 }, { armies: 3 });
  expect(high).toBeGreaterThan(low);
});

test('territoryPriority increases with enemy neighbors', () => {
  const map = {
    b: { owner: 1 },
    c: { owner: 1 },
    e: { owner: 1 }
  };
  const game = new MockGame(map);
  const t1 = { id: 'a', owner: 0, neighbors: ['b', 'c'], armies: 1 };
  const t2 = { id: 'd', owner: 0, neighbors: ['e'], armies: 1 };
  expect(territoryPriority(game, t1)).toBeGreaterThan(territoryPriority(game, t2));
});
