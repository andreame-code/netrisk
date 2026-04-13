const assert = require("node:assert/strict");
const { calculateReinforcements } = require("../../../backend/engine/reinforcement-calculator.cjs");
const { makeContinent, makePlayers, makeState, territoryStates } = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("calculateReinforcements enforces a minimum of 3", () => {
  const players = makePlayers(["Alice", "Bob"]);
  const state = makeState({
    players,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 },
      { id: "c", ownerId: "p2", armies: 1 }
    ])
  });

  const result = calculateReinforcements(state, "p1");
  assert.equal(result.baseReinforcements, 3);
  assert.equal(result.minimumApplied, true);
  assert.equal(result.totalReinforcements, 3);
});

register("calculateReinforcements uses territory count and continent bonuses", () => {
  const players = makePlayers(["Alice", "Bob"]);
  const state = makeState({
    players,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 },
      { id: "c", ownerId: "p1", armies: 1 },
      { id: "d", ownerId: "p1", armies: 1 },
      { id: "e", ownerId: "p1", armies: 1 },
      { id: "f", ownerId: "p1", armies: 1 },
      { id: "g", ownerId: "p1", armies: 1 },
      { id: "h", ownerId: "p1", armies: 1 },
      { id: "i", ownerId: "p1", armies: 1 }
    ]),
    continents: [makeContinent("north", ["a", "b", "c"], 2)]
  });

  const result = calculateReinforcements(state, "p1");
  assert.equal(result.territoryCount, 9);
  assert.equal(result.baseReinforcements, 3);
  assert.equal(result.continentBonusTotal, 2);
  assert.equal(result.totalReinforcements, 5);
});

register("calculateReinforcements rejects unknown players", () => {
  const state = makeState({ players: makePlayers(["Alice"]) });
  assert.throws(() => calculateReinforcements(state, "missing"), /unknown player/i);
});
