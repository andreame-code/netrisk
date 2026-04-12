// @ts-nocheck
const assert = require("node:assert/strict");
const classicMiniMap = require("../../../shared/maps/classic-mini.cjs");
const middleEarthMap = require("../../../shared/maps/middle-earth.cjs");
const worldClassicMap = require("../../../shared/maps/world-classic.cjs");

function bonusMapFor(map) {
  return Object.fromEntries(map.continents.map((continent) => [continent.id, continent.bonus]));
}

register("supported maps expose the expected continent bonuses", () => {
  assert.deepEqual(bonusMapFor(classicMiniMap), {
    north: 1,
    central: 2,
    east: 1,
    south: 1
  });

  assert.deepEqual(bonusMapFor(middleEarthMap), {
    eriador: 2,
    rohan: 3,
    rhovanion: 4,
    mirkwood: 3,
    rhun: 2,
    gondor: 2,
    mordor: 3,
    haradwaith: 2
  });

  assert.deepEqual(bonusMapFor(worldClassicMap), {
    north_america: 5,
    south_america: 2,
    europe: 5,
    africa: 3,
    asia: 7,
    australia: 2
  });
});
