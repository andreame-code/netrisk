const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require("jsdom");
const {
  getLevelAccessibility,
  applyLevelAccessibility,
} = require("../src/data/level-accessibility.js");

describe("level accessibility settings", () => {
  test("level 3 enables high contrast and jump assist", () => {
    const opts = getLevelAccessibility("map3");
    expect(opts).toEqual({ highContrast: true, jumpAssist: true });
  });

  test("other levels disable accessibility extras", () => {
    ["map", "map2", "map-roman"].forEach((id) => {
      const opts = getLevelAccessibility(id);
      expect(opts.highContrast).toBe(false);
      expect(opts.jumpAssist).toBe(false);
    });
  });

  test("applyLevelAccessibility adds classes to document body", () => {
    const dom = new JSDOM("<body></body>");
    const { document } = dom.window;
    applyLevelAccessibility("map3", document);
    expect(document.body.classList.contains("high-contrast")).toBe(true);
    expect(document.body.classList.contains("jump-assist")).toBe(true);
  });
});
