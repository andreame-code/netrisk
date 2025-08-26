import { colorPalette } from './colors.js';
import { readFileSync } from 'fs';
jest.mock('./navigation.js', () => ({ navigateTo: jest.fn(), goHome: jest.fn() }));

function setupDOM() {
  document.body.innerHTML = `
      <form id="setupForm">
        <input id="humanCount" />
        <input id="aiCount" />
        <select id="aiDifficulty">
          <option value="easy">easy</option>
          <option value="normal">normal</option>
          <option value="hard">hard</option>
        </select>
        <select id="aiStyle">
          <option value="aggressive">aggressive</option>
          <option value="balanced">balanced</option>
          <option value="defensive">defensive</option>
        </select>
        <div id="players"></div>
        <input type="hidden" id="mapSelect" />
        <div id="mapGrid"></div>
      </form>`;
}

describe('setup map selection', () => {
  beforeEach(() => {
    setupDOM();
    localStorage.clear();
    window.alert = jest.fn();
    jest.resetModules();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('saves selected map to localStorage and navigates to game', async () => {
    const manifest = {
      version: 1,
      maps: [
        { id: 'map', name: 'Classic', difficulty: 'Easy', territories: 1, bonuses: {}, thumbnail: 'map.svg', description: '' },
        { id: 'map3', name: 'Grid', difficulty: 'Easy', territories: 1, bonuses: {}, thumbnail: 'map3.svg', description: '' },
      ],
    };
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve(manifest) }));
    const { navigateTo } = require('./navigation.js');
    const { mapLoadPromise } = require('./setup.js');
    await mapLoadPromise;
    document.getElementById('humanCount').value = '1';
    document.getElementById('aiCount').value = '0';
    document.getElementById('name0').value = 'P1';
    document.getElementById('color0').value = colorPalette[0];
    document.querySelector('.map-item[data-id="map3"]').click();
    document.getElementById('setupForm').dispatchEvent(new Event('submit'));
    expect(localStorage.getItem('netriskMap')).toBe('map3');
    expect(navigateTo).toHaveBeenCalledWith('game.html');
  });

  test('renders responsive grid', async () => {
    const manifest = { version: 1, maps: [{ id: 'map', name: 'Classic', difficulty: 'Easy', territories: 1, bonuses: {}, thumbnail: 'map.svg', description: '' }] };
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve(manifest) }));
    const { mapLoadPromise } = require('./setup.js');
    await mapLoadPromise;
    const grid = document.getElementById('mapGrid');
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toContain('auto-fit');
  });

  test('shows placeholder when thumbnail missing', async () => {
    const manifest = { version: 1, maps: [{ id: 'map', name: 'Classic', difficulty: 'Easy', territories: 1, bonuses: {}, thumbnail: 'missing.svg', description: '' }] };
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve(manifest) }));
    const { mapLoadPromise } = require('./setup.js');
    await mapLoadPromise;
    const img = document.querySelector('.map-item img');
    img.dispatchEvent(new Event('error'));
    expect(document.querySelector('.map-item .placeholder')).not.toBeNull();
  });

  test('saves AI difficulty and style', async () => {
    const manifest = { version: 1, maps: [{ id: 'map', name: 'Classic', difficulty: 'Easy', territories: 1, bonuses: {}, thumbnail: 'map.svg', description: '' }] };
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve(manifest) }));
    const { mapLoadPromise } = require('./setup.js');
    await mapLoadPromise;
    document.getElementById('humanCount').value = '1';
    document.getElementById('aiCount').value = '1';
    document.getElementById('aiDifficulty').value = 'hard';
    document.getElementById('aiStyle').value = 'aggressive';
    document.getElementById('name0').value = 'P1';
    document.getElementById('color0').value = colorPalette[0];
    document.getElementById('setupForm').dispatchEvent(new Event('submit'));
    const saved = JSON.parse(localStorage.getItem('netriskPlayers'));
    expect(saved[1]).toEqual(expect.objectContaining({ ai: true, difficulty: 'hard', style: 'aggressive' }));
  });

  test('has back to home link', () => {
    const html = readFileSync('./setup.html', 'utf8');
    expect(html).toMatch(/id="backHome"/);
    expect(html).toMatch(/Back to Home/);
  });
});
