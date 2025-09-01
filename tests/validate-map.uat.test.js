const validateMap = require("../src/validate-map.js");

describe("validateMap", () => {
  test("returns true for a valid map", () => {
    // eslint-disable-next-line global-require
    const data = require("../src/data/map.json");
    expect(validateMap(data)).toBe(true);
  });

  test("throws error when required fields are missing", () => {
    const invalid = {
      schemaVersion: 1,
      territories: [{ id: "a", neighbors: [], x: 0, y: 0 }],
      continents: [],
      // deck is missing
    };
    expect(() => validateMap(invalid)).toThrow("Invalid map data");
  });

  test("ignores neighbors pointing to missing territories", () => {
    const invalidNeighbors = {
      schemaVersion: 1,
      territories: [
        { id: "a", neighbors: ["b"], x: 0, y: 0 },
        { id: "c", neighbors: [], x: 1, y: 1 },
      ],
      continents: [],
      deck: [],
    };
    expect(validateMap(invalidNeighbors)).toBe(true);
  });
});
