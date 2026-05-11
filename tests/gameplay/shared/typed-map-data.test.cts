const assert = require("node:assert/strict");
const { buildMapDefinition } = require("../../../shared/typed-map-data.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("buildMapDefinition rejects empty territory records", () => {
  assert.throws(() => buildMapDefinition("empty-map", []), /at least one territory/i);
});

register("buildMapDefinition rejects non-bidirectional adjacency", () => {
  assert.throws(
    () =>
      buildMapDefinition("test-map", [
        {
          id: "alpha",
          name: "Alpha",
          continentId: "north",
          x: 0.1,
          y: 0.2,
          neighbors: ["beta"]
        },
        {
          id: "beta",
          name: "Beta",
          continentId: "north",
          x: 0.3,
          y: 0.4,
          neighbors: []
        }
      ]),
    /must be bidirectional/i
  );
});

register("buildMapDefinition rejects unknown neighbors", () => {
  assert.throws(
    () =>
      buildMapDefinition("test-map", [
        {
          id: "alpha",
          name: "Alpha",
          continentId: "north",
          x: 0.1,
          y: 0.2,
          neighbors: ["missing"]
        }
      ]),
    /unknown neighbor "missing"/i
  );
});
