const fs = require('fs');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');
const initTerritorySelection = require('../src/territory-selection.js').default;

const flushPromises = () => new Promise((res) => setTimeout(res, 0));

describe('Accessibility features', () => {
  test('buttons expose aria-labels and access keys', () => {
    const html = fs.readFileSync('index.html', 'utf-8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const ids = ['themeToggle', 'playBtn', 'setupBtn', 'howToPlayBtn', 'aboutBtn'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      expect(el).not.toBeNull();
      expect(el.getAttribute('aria-label')).toBeTruthy();
      expect(el.getAttribute('accesskey')).toBeTruthy();
    });
  });

  test('territories are accessible via keyboard with ARIA labels', async () => {
    document.body.innerHTML = '<div id="board"></div><div id="selectedTerritory"></div>';
    const svg =
      '<svg id="map"><path id="A" class="map-territory"/><path id="B" class="map-territory"/></svg>';
    global.fetch = jest.fn(() =>
      Promise.resolve({ text: () => Promise.resolve(svg) }),
    );
    const territories = [
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ];
    initTerritorySelection({ territories });
    await flushPromises();
    const btnA = document.querySelector('button#A');
    expect(btnA.getAttribute('aria-label')).toBe('Alpha');
    const pathA = document.querySelector('#map #A');
    expect(pathA.getAttribute('tabindex')).toBe('0');
    expect(pathA.getAttribute('role')).toBe('button');
    pathA.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(document.getElementById('selectedTerritory').textContent).toBe('A');
  });

  test('victory charts include ARIA labels', () => {
    const js = fs.readFileSync('src/main.js', 'utf-8');
    expect(js).toMatch(
      'canvas id="territoryChart" aria-label="Territories per turn" role="img"',
    );
    expect(js).toMatch(
      'canvas id="armiesChart" aria-label="Armies placed per turn" role="img"',
    );
    expect(js).toMatch(
      'canvas id="attackChart" aria-label="Attacks won and lost" role="img"',
    );
  });
});

