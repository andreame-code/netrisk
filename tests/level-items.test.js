const { getLevelItems } = require('../src/data/special-items.js');

describe('level item availability', () => {
  test('level 3 has star dust, crystal key, and rainbow portal', () => {
    const items = getLevelItems('map3');
    expect(items.starDust).toBe(30);
    expect(items.crystalKey).toBe(true);
    expect(items.rainbowPortal).toBe(true);
  });

  test('other levels lack star dust, key, and portal', () => {
    ['map', 'map2', 'map-roman'].forEach((id) => {
      const items = getLevelItems(id);
      expect(items.starDust).toBe(0);
      expect(items.crystalKey).toBe(false);
      expect(items.rainbowPortal).toBe(false);
    });
  });

  test('unknown levels default to no special items', () => {
    const items = getLevelItems('unknown');
    expect(items.starDust).toBe(0);
    expect(items.crystalKey).toBe(false);
    expect(items.rainbowPortal).toBe(false);
  });
});
