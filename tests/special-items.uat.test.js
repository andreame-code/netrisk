const { getLevelItems } = require('../src/data/special-items.js');

function toItemArray(items) {
  return Object.entries(items)
    .filter(([, value]) => value)
    .map(([name]) => name);
}

describe('special items availability', () => {
  test('map3 includes all special items', () => {
    const items = getLevelItems('map3');
    expect(toItemArray(items)).toEqual(['starDust', 'crystalKey', 'rainbowPortal']);
  });

  test('other and unknown levels provide no special items', () => {
    ['map', 'map2', 'map-roman', 'unknown'].forEach((id) => {
      const items = getLevelItems(id);
      expect(toItemArray(items)).toEqual([]);
      expect(items.starDust).toBe(0);
      expect(items.crystalKey).toBe(false);
      expect(items.rainbowPortal).toBe(false);
    });
  });
});
