// @ts-nocheck
const assert = require("node:assert/strict");
const { resolveConquest } = require("../../../backend/engine/conquest-resolution.cjs");
const { makePlayers, makeState, territoryStates } = require("../helpers/state-builder.cjs");

function makeCombatResult() {
  return {
    details: { playerId: "p1" },
    combat: {
      fromTerritoryId: "a",
      toTerritoryId: "b",
      attackDiceCount: 2,
      defenderReducedToZero: true
    }
  };
}

register("resolveConquest changes owner and moves armies on a valid conquest", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 4 },
      { id: "b", ownerId: "p2", armies: 0 }
    ])
  });

  const result = resolveConquest(state, makeCombatResult(), 2);
  assert.equal(result.ok, true);
  assert.equal(state.territories.a.armies, 2);
  assert.equal(state.territories.b.ownerId, "p1");
  assert.equal(state.territories.b.armies, 2);
});

register("resolveConquest rejects moves below the minimum required", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 4 },
      { id: "b", ownerId: "p2", armies: 0 }
    ])
  });

  const result = resolveConquest(state, makeCombatResult(), 1);
  assert.equal(result.ok, false);
  assert.equal(result.code, "MOVE_BELOW_MINIMUM");
});

register("resolveConquest rejects moves that leave the source empty", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 3 },
      { id: "b", ownerId: "p2", armies: 0 }
    ])
  });

  const result = resolveConquest(state, makeCombatResult(), 3);
  assert.equal(result.ok, false);
  assert.equal(result.code, "MOVE_EXCEEDS_AVAILABLE");
});

