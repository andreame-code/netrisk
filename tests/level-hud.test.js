const { getHudElements } = require('../src/data/level-hud.js');

describe('level HUD elements', () => {
  test('level 3 shows star dust, crystal key, and power-up icons', () => {
    const hud = getHudElements('map3');
    expect(hud.starDust).toBe(true);
    expect(hud.crystalKey).toBe(true);
    expect(hud.powerUps).toBe(true);
  });

  test('other levels show base HUD only', () => {
    ['map', 'map2', 'map-roman'].forEach((id) => {
      const hud = getHudElements(id);
      expect(hud.starDust).toBe(false);
      expect(hud.crystalKey).toBe(false);
      expect(hud.powerUps).toBe(false);
    });
  });
});
