const { updateCamera, getParallaxOffset } = require('../src/camera.js');

function approx(value) {
  return Number(value.toFixed(5));
}

describe('dead-zone camera', () => {
  const viewport = { width: 100, height: 100 };
  const level = { width: 300, height: 200 };
  const params = { deadZoneWidthPct: 0.5, deadZoneHeightPct: 0.5, cameraLerp: 0.5 };

  test('camera stays while player in dead-zone', () => {
    const camera = { x: 0, y: 0 };
    const p1 = { x: 50, y: 50 };
    const next = updateCamera(p1, camera, level, viewport, params);
    expect(next).toEqual({ x: 0, y: 0 });
  });

  test('camera moves smoothly and clamps', () => {
    let camera = { x: 0, y: 0 };
    // move to right
    camera = updateCamera({ x: 100, y: 50 }, camera, level, viewport, params);
    expect(approx(camera.x)).toBe(12.5);
    // extreme right triggers clamp
    camera = updateCamera({ x: 290, y: 50 }, camera, level, viewport, params);
    expect(camera.x).toBeLessThanOrEqual(200);
    expect(camera.x).toBeGreaterThan(12.5);
  });

  test('parallax uses camera position', () => {
    const off1 = getParallaxOffset({ x: 0, y: 0 }, 0.5);
    const off2 = getParallaxOffset({ x: 50, y: 0 }, 0.5);
    expect(off1.x).toBeCloseTo(0);
    expect(off2.x).toBe(-25);
  });
});
