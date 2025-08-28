const { getLevelCamera } = require('../src/data/level-camera.js');

describe('level camera params', () => {
  test('level 3 defines dead-zone and lerp', () => {
    const cam = getLevelCamera('map3');
    expect(cam.deadZoneWidthPct).toBe(0.5);
    expect(cam.deadZoneHeightPct).toBe(0.5);
    expect(cam.cameraLerp).toBe(0.1);
  });

  test('other levels use default camera', () => {
    ['map', 'map2', 'map-roman'].forEach((id) => {
      const cam = getLevelCamera(id);
      expect(cam).toEqual({
        deadZoneWidthPct: 1,
        deadZoneHeightPct: 1,
        cameraLerp: 1,
      });
    });
  });
});
