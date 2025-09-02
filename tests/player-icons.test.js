import fs from 'fs';
import path from 'path';
import { colorPalette } from '../src/colors.js';

describe('player icon assets', () => {
  const base = path.join(process.cwd(), 'public', 'assets', 'players');
  const colors = colorPalette.slice(0, 8);
  colors.forEach((color, idx) => {
    test(`player ${idx + 1} icon exists with correct color`, () => {
      const file = path.join(base, `player${idx + 1}.svg`);
      expect(fs.existsSync(file)).toBe(true);
      const svg = fs.readFileSync(file, 'utf8');
      expect(svg).toContain(color);
    });
  });
});
