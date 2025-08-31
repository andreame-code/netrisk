const { getLevelMusic } = require("../src/audio.js");

describe("level specific music", () => {
  test("level 3 uses fairy music loop", () => {
    expect(getLevelMusic("map3")).toBe("assets/fairy-music.mp3");
  });

  test("other levels use default music loop", () => {
    ["map", "map2", "map-roman"].forEach((id) => {
      expect(getLevelMusic(id)).toBe("assets/music.mp3");
    });
  });
});
