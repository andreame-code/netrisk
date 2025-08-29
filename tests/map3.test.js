const fs = require('fs');
const map = require('../src/maps/map3/config.json');
const world8 = require('../src/maps/world8/config.json');

const flushPromises = () => new Promise((res) => setTimeout(res, 0));

describe('map3 data', () => {
  test('territories have unique ids and reciprocal neighbors', () => {
    const ids = new Set(map.territories.map((t) => t.id));
    expect(ids.size).toBe(map.territories.length);
    const byId = Object.fromEntries(map.territories.map((t) => [t.id, t]));
    for (const t of map.territories) {
      for (const n of t.neighbors) {
        expect(byId[n]).toBeTruthy();
        expect(byId[n].neighbors).toContain(t.id);
      }
    }
  });

  test('continents cover all territories', () => {
    const terrIds = new Set(map.territories.map((t) => t.id));
    const contIds = new Set(map.continents.flatMap((c) => c.territories));
    expect(contIds).toEqual(terrIds);
  });

  test('deck has one of each type per territory', () => {
    const types = ['infantry', 'cavalry', 'artillery'];
    const counts = {};
    for (const card of map.deck) {
      if (!counts[card.territory]) counts[card.territory] = {};
      counts[card.territory][card.type] =
        (counts[card.territory][card.type] || 0) + 1;
    }
    for (const id of Object.keys(counts)) {
      for (const t of types) {
        expect(counts[id][t]).toBe(1);
      }
    }
  });
});

describe('world8 data', () => {
  test('territories have unique ids and reciprocal neighbors', () => {
    const ids = new Set(world8.territories.map((t) => t.id));
    expect(ids.size).toBe(world8.territories.length);
    const byId = Object.fromEntries(world8.territories.map((t) => [t.id, t]));
    for (const t of world8.territories) {
      for (const n of t.neighbors) {
        expect(byId[n]).toBeTruthy();
        expect(byId[n].neighbors).toContain(t.id);
      }
    }
  });
});

describe('territory-selection with map3', () => {
  test('fetches svg and creates territory buttons', async () => {
    document.body.innerHTML = '<div id="board"></div><div id="selectedTerritory"></div>';
    localStorage.setItem('netriskMap', 'map3');
    const svg = fs.readFileSync('public/maps/map3/map.svg', 'utf8');
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(svg) }),
    );
    const init = require('../src/territory-selection.js').default;
    init({ territories: map.territories, territoryPositions: {} });
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith('maps/map3/map.svg');
    const buttons = document.querySelectorAll('button.territory');
    expect(buttons).toHaveLength(map.territories.length);
  });

  test('token is appended after territory buttons', async () => {
    document.body.innerHTML = '<div id="board"></div><div id="selectedTerritory"></div>';
    localStorage.setItem('netriskMap', 'map3');
    const svg = fs.readFileSync('public/maps/map3/map.svg', 'utf8');
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(svg) }),
    );
    const init = require('../src/territory-selection.js').default;
    init({ territories: map.territories, territoryPositions: {} });
    await flushPromises();
    const board = document.getElementById('board');
    const token = document.getElementById('token');
    expect(board.lastElementChild).toBe(token);
  });
});
