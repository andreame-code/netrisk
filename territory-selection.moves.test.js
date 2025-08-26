import initTerritorySelection from './territory-selection.js';
import { ATTACK } from './phases.js';

const flushPromises = () => new Promise((res) => setTimeout(res, 0));

test('selecting territory highlights possible moves', async () => {
  document.body.innerHTML = '<div id="board"></div><div id="selectedTerritory"></div>';
  const svg = '<svg id="map"><path id="A" class="map-territory"/><path id="B" class="map-territory"/><path id="C" class="map-territory"/></svg>';
  global.fetch = jest.fn(() => Promise.resolve({ text: () => Promise.resolve(svg) }));
  const territories = [
    { id: 'A', neighbors: ['B'], owner: 0 },
    { id: 'B', neighbors: ['A', 'C'], owner: 1 },
    { id: 'C', neighbors: ['B'], owner: 0 },
  ];
  const game = {
    currentPlayer: 0,
    getPhase: () => ATTACK,
    territoryById: (id) => territories.find((t) => t.id === id),
  };
  initTerritorySelection({ game, territories });
  await flushPromises();
  const aPath = document.getElementById('A');
  aPath.dispatchEvent(new Event('click', { bubbles: true }));
  const buttonB = document.getElementById('B');
  expect(buttonB.classList.contains('possible-move')).toBe(true);
});
