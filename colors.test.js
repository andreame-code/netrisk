import { colorPalette, getContrastingColor } from "./colors.js";

describe("getContrastingColor", () => {
  test("returns black for light colors", () => {
    expect(getContrastingColor("#ffffff")).toBe("#000000");
  });

  test("returns white for dark colors", () => {
    expect(getContrastingColor("#000000")).toBe("#ffffff");
  });

  test("supports short hex notation", () => {
    expect(getContrastingColor("#fff")).toBe("#000000");
    expect(getContrastingColor("#000")).toBe("#ffffff");
  });
});

describe("colorPalette", () => {
  test("contains 12 colors", () => {
    expect(colorPalette).toHaveLength(12);
  });
});
