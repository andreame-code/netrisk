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
    const mapPath = path.join(distDir, 'src', 'maps', 'map', 'config.json');
    expect(fs.existsSync(mapPath)).toBe(true);
    const romanPath = path.join(distDir, 'src', 'maps', 'map-roman', 'config.json');
    expect(fs.existsSync(romanPath)).toBe(true);
    const map3Path = path.join(distDir, 'src', 'maps', 'map3', 'config.json');
    expect(fs.existsSync(map3Path)).toBe(true);
  });
});
