/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('build script', () => {
  beforeAll(() => {
    execSync('node build.js');
  });

  afterAll(() => {
    fs.rmSync(path.join(__dirname, 'dist'), { recursive: true, force: true });
  });

  test('copies map data file', () => {
    const mapPath = path.join(__dirname, 'dist', 'src', 'data', 'map.json');
    expect(fs.existsSync(mapPath)).toBe(true);
    const romanPath = path.join(__dirname, 'dist', 'src', 'data', 'map-roman.json');
    expect(fs.existsSync(romanPath)).toBe(true);
    const map3Path = path.join(__dirname, 'dist', 'src', 'data', 'map3.json');
    expect(fs.existsSync(map3Path)).toBe(true);
  });
});
