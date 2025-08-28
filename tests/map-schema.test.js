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
});
