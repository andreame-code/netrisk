import { getContrastingColor } from "../src/colors.js";

describe("getContrastingColor UAT", () => {
  test("returns black for light colors", () => {
    expect(getContrastingColor("#eeeeee")).toBe("#000000");
  });

  test("returns white for dark colors", () => {
    expect(getContrastingColor("#111111")).toBe("#ffffff");
  });
});
