const fs = require('fs');
const path = require('path');
const validateMap = require('../src/validate-map.js');

const maps = ['map.json', 'map2.json', 'map3.json', 'map-roman.json', 'world8.json'];

describe('map schema validation', () => {
  test.each(maps)('%s matches schema', (file) => {
    // eslint-disable-next-line global-require
    const data = require(`../src/data/${file}`);
    expect(() => validateMap(data)).not.toThrow();
  });

  test('invalid map fails schema', () => {
    const bad = {
      schemaVersion: 1,
      territories: [{ id: 'a', neighbors: [], x: 0, y: 0 }],
      continents: [],
      deck: [],
    };
    delete bad.territories[0].y;
    expect(() => validateMap(bad)).toThrow('Invalid map data');
  });

  test('world8 territories have unique ids and reciprocal neighbors', () => {
    // eslint-disable-next-line global-require
    const map = require('./fixtures/maps/world8.json');
    const ids = new Set(map.territories.map((t) => t.id));
    expect(ids.size).toBe(map.territories.length);
    const byId = Object.fromEntries(map.territories.map((t) => [t.id, t]));
    for (const terr of map.territories) {
      for (const n of terr.neighbors) {
        expect(byId[n]).toBeTruthy();
        expect(byId[n].neighbors).toContain(terr.id);
      }
    }
  });

  test('world8 SVG root element uses expected id', () => {
    const svgPath = path.join(__dirname, '..', 'public', 'assets', 'maps', 'world8.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const match = svgContent.match(/<svg[^>]*id="([^"]+)"/);
    expect(match && match[1]).toBe('map');
  });
});
