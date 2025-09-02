/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('build script', () => {
  const distDir = path.join(__dirname, '..', 'dist');
  beforeAll(() => {
    execSync('node src/build.js');
  });

  afterAll(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  test('copies map data file', () => {
    const mapPath = path.join(distDir, 'src', 'data', 'map.json');
    expect(fs.existsSync(mapPath)).toBe(true);
    const romanPath = path.join(distDir, 'src', 'data', 'map-roman.json');
    expect(fs.existsSync(romanPath)).toBe(true);
    const map3Path = path.join(distDir, 'src', 'data', 'map3.json');
    expect(fs.existsSync(map3Path)).toBe(true);
  });
});
