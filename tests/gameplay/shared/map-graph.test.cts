const assert = require("node:assert/strict");
const { buildMapGraph } = require("../../../shared/map-graph.cjs");
const { makeTerritory } = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("buildMapGraph builds a valid undirected graph and exposes adjacency queries", () => {
  const graph = buildMapGraph([
    { territory: makeTerritory("a", ["b", "c"]) },
    makeTerritory("b", ["a", "c"]),
    makeTerritory("c", ["a", "b"])
  ]);

  assert.equal(graph.size, 3);
  assert.deepEqual(graph.territoryIds, ["a", "b", "c"]);
  assert.equal(graph.edgeCount, 3);
  assert.equal(graph.hasTerritory("a"), true);
  assert.equal(graph.hasTerritory("missing"), false);
  assert.deepEqual(graph.getNeighbors("a"), ["b", "c"]);
  assert.equal(graph.areAdjacent("a", "b"), true);
  assert.equal(graph.areAdjacent("b", "a"), true);
  assert.equal(graph.areAdjacent("a", "a"), false);
});

register("buildMapGraph rejects non-array input", () => {
  assert.throws(() => buildMapGraph(null as any), /requires an array/i);
});

register("buildMapGraph rejects entries without a territory id", () => {
  assert.throws(
    () =>
      buildMapGraph([
        makeTerritory("a", ["b"]),
        { territory: { id: null, neighbors: ["a"] } }
      ] as any),
    /missing an id/i
  );
});

register("buildMapGraph rejects territories whose neighbors are not arrays", () => {
  assert.throws(
    () =>
      buildMapGraph([makeTerritory("a", ["b"]), { territory: { id: "b", neighbors: "a" } }] as any),
    /neighbors as an array/i
  );
});

register("buildMapGraph rejects duplicate territory ids", () => {
  assert.throws(
    () => buildMapGraph([makeTerritory("a", ["b"]), makeTerritory("a", ["b"])]),
    /Duplicate territory id "a"/i
  );
});

register("buildMapGraph rejects self links", () => {
  assert.throws(() => buildMapGraph([makeTerritory("a", ["a"])]), /cannot link to itself/i);
});

register("buildMapGraph rejects unknown neighbors", () => {
  assert.throws(
    () => buildMapGraph([makeTerritory("a", ["missing"]), makeTerritory("b", [])]),
    /unknown neighbor "missing"/i
  );
});

register("buildMapGraph rejects duplicate links declared by the same territory", () => {
  assert.throws(
    () => buildMapGraph([makeTerritory("a", ["b", "b"]), makeTerritory("b", ["a"])]),
    /duplicate link to "b"/i
  );
});

register("buildMapGraph rejects non-bidirectional adjacency", () => {
  assert.throws(
    () => buildMapGraph([makeTerritory("a", ["b"]), makeTerritory("b", [])]),
    /must be bidirectional/i
  );
});

register("buildMapGraph rejects unknown territories in getNeighbors and areAdjacent", () => {
  const graph = buildMapGraph([makeTerritory("a", ["b"]), makeTerritory("b", ["a"])]);

  assert.throws(() => graph.getNeighbors("missing"), /Unknown territory "missing"/i);
  assert.throws(() => graph.areAdjacent("missing", "a"), /Unknown territory "missing"/i);
  assert.throws(() => graph.areAdjacent("a", "missing"), /Unknown territory "missing"/i);
});
