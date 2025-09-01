const { getLevelObstacles } = require("../src/data/level-obstacles.js");

describe("level obstacle availability", () => {
  test("level 3 has purple brambles, moon milk, and seed walls", () => {
    const obstacles = getLevelObstacles("map3");
    expect(obstacles.purpleBrambles).toEqual({ damage: "instant" });
    expect(obstacles.moonMilk).toEqual({ respawn: "checkpoint" });
    expect(obstacles.seedWalls).toEqual({ destructibleWith: "shield" });
  });

  test("other levels lack special obstacles", () => {
    ["map", "map2", "map-roman"].forEach((id) => {
      const obstacles = getLevelObstacles(id);
      expect(obstacles.purpleBrambles).toBeUndefined();
      expect(obstacles.moonMilk).toBeUndefined();
      expect(obstacles.seedWalls).toBeUndefined();
    });
  });
});
