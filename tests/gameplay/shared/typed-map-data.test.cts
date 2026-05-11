const assert = require("node:assert/strict");
const {
  buildContinentDefinition,
  buildMapDefinition
} = require("../../../shared/typed-map-data.cjs");

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

register("buildMapDefinition rejects invalid territory fields before building adjacency", () => {
  assert.throws(
    () =>
      buildMapDefinition("test-map", [
        {
          id: "",
          name: "Missing Id",
          continentId: "north",
          x: 0.1,
          y: 0.2,
          neighbors: []
        }
      ]),
    /territory without id/i
  );

  assert.throws(
    () =>
      buildMapDefinition("test-map", [
        {
          id: "alpha",
          name: "",
          continentId: "north",
          x: 0.1,
          y: 0.2,
          neighbors: []
        }
      ]),
    /missing a name/i
  );

  assert.throws(
    () =>
      buildMapDefinition("test-map", [
        {
          id: "alpha",
          name: "Alpha",
          continentId: "north",
          x: Number.POSITIVE_INFINITY,
          y: 0.2,
          neighbors: []
        }
      ]),
    /invalid x coordinate/i
  );

  assert.throws(
    () =>
      buildMapDefinition("test-map", [
        {
          id: "alpha",
          name: "Alpha",
          continentId: "north",
          x: 0.1,
          y: 1.2,
          neighbors: []
        }
      ]),
    /between 0 and 1/i
  );
});

register("buildMapDefinition rejects duplicate territory ids", () => {
  assert.throws(
    () =>
      buildMapDefinition("test-map", [
        {
          id: "alpha",
          name: "Alpha",
          continentId: "north",
          x: 0.1,
          y: 0.2,
          neighbors: []
        },
        {
          id: "alpha",
          name: "Duplicate Alpha",
          continentId: "south",
          x: 0.3,
          y: 0.4,
          neighbors: []
        }
      ]),
    /duplicate territory id "alpha"/i
  );
});

register("buildContinentDefinition validates required fields and unknown territories", () => {
  assert.throws(() => buildContinentDefinition("empty-continents", []), /at least one continent/i);

  assert.throws(
    () =>
      buildContinentDefinition("test-continents", [
        { id: "", name: "Missing Id", bonus: 2, territoryIds: [] }
      ]),
    /continent without id/i
  );

  assert.throws(
    () =>
      buildContinentDefinition("test-continents", [
        { id: "north", name: "", bonus: 2, territoryIds: [] }
      ]),
    /missing a name/i
  );

  assert.throws(
    () =>
      buildContinentDefinition("test-continents", [
        { id: "north", name: "North", bonus: Number.NaN, territoryIds: [] }
      ]),
    /invalid bonus value/i
  );

  assert.throws(
    () =>
      buildContinentDefinition(
        "test-continents",
        [{ id: "north", name: "North", bonus: 2, territoryIds: ["missing"] }],
        { validTerritoryIds: ["alpha"] }
      ),
    /references unknown territory "missing"/i
  );
});
