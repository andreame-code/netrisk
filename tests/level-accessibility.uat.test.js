const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');
const {
  getLevelAccessibility,
  applyLevelAccessibility,
} = require('../src/data/level-accessibility.js');

describe('level accessibility UAT', () => {
  test('applyLevelAccessibility adds classes to DOM', () => {
    const dom = new JSDOM('<body></body>');
    const { document } = dom.window;
    applyLevelAccessibility('map3', document);
    expect(document.body.classList.contains('high-contrast')).toBe(true);
    expect(document.body.classList.contains('jump-assist')).toBe(true);
  });

  test('unknown levels return default accessibility options', () => {
    const opts = getLevelAccessibility('unknown');
    expect(opts).toEqual({ highContrast: false, jumpAssist: false });
  });

  test('applyLevelAccessibility does nothing for unknown levels', () => {
    const dom = new JSDOM('<body></body>');
    const { document } = dom.window;
    const opts = applyLevelAccessibility('unknown', document);
    expect(document.body.classList.contains('high-contrast')).toBe(false);
    expect(document.body.classList.contains('jump-assist')).toBe(false);
    expect(opts).toEqual({ highContrast: false, jumpAssist: false });
  });
});
