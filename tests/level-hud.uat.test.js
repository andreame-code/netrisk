const { getHudElements } = require("../src/data/level-hud.js");

describe("level HUD elements (UAT)", () => {
  const required = ["starDust", "crystalKey", "powerUps"];

  const expectStructure = (hud) => {
    required.forEach((prop) => expect(hud).toHaveProperty(prop));
  };

  test.each([
    ["map", { starDust: false, crystalKey: false, powerUps: false }],
    ["map2", { starDust: false, crystalKey: false, powerUps: false }],
    ["map3", { starDust: true, crystalKey: true, powerUps: true }],
    ["map-roman", { starDust: false, crystalKey: false, powerUps: false }],
  ])("returns expected HUD for %s", (id, expected) => {
    const hud = getHudElements(id);
    expectStructure(hud);
    expect(hud).toEqual(expected);
  });

  test("unknown level returns base HUD structure", () => {
    const hud = getHudElements("unknown-level");
    expectStructure(hud);
    expect(hud).toEqual({
      starDust: false,
      crystalKey: false,
      powerUps: false,
    });
  });
});
