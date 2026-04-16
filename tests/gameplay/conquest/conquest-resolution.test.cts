const assert = require("node:assert/strict");
const { resolveConquest } = require("../../../backend/engine/conquest-resolution.cjs");
const { makePlayers, makeState, territoryStates } = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

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
  assert.equal(result.conquest.minimumMove, 2);
  assert.equal(result.conquest.attackerArmiesRemaining, 2);
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

register(
  "resolveConquest rejects conquest attempts before the defender has been eliminated",
  () => {
    const state = makeState({
      players: makePlayers(["Alice", "Bob"]),
      territories: territoryStates([
        { id: "a", ownerId: "p1", armies: 4 },
        { id: "b", ownerId: "p2", armies: 1 }
      ])
    });

    const result = resolveConquest(
      state,
      {
        details: { playerId: "p1" },
        combat: {
          fromTerritoryId: "a",
          toTerritoryId: "b",
          attackDiceCount: 2,
          defenderReducedToZero: false
        }
      },
      2
    );

    assert.equal(result.ok, false);
    assert.equal(result.code, "CONQUEST_NOT_AVAILABLE");
    assert.equal(state.territories.a.armies, 4);
    assert.equal(state.territories.b.ownerId, "p2");
    assert.equal(state.territories.b.armies, 1);
  }
);

register("resolveConquest rejects non-integer move counts", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 4 },
      { id: "b", ownerId: "p2", armies: 0 }
    ])
  });

  const result = resolveConquest(state, makeCombatResult(), 1.5);
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_MOVE_COUNT");
});

register("resolveConquest throws when the attacker territory state is missing", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([{ id: "b", ownerId: "p2", armies: 0 }])
  });

  assert.throws(() => resolveConquest(state, makeCombatResult(), 2), /attacker territory state/i);
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

register("resolveConquest throws when the combat result has no attacking player id", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 4 },
      { id: "b", ownerId: "p2", armies: 0 }
    ])
  });

  assert.throws(
    () =>
      resolveConquest(
        state,
        {
          details: {},
          combat: {
            fromTerritoryId: "a",
            toTerritoryId: "b",
            attackDiceCount: 2,
            defenderReducedToZero: true
          }
        },
        2
      ),
    /attacking player id/i
  );
});

register(
  "resolveConquest defaults the minimum move to one army when combat dice are missing",
  () => {
    const state = makeState({
      players: makePlayers(["Alice", "Bob"]),
      territories: territoryStates([
        { id: "a", ownerId: "p1", armies: 3 },
        { id: "b", ownerId: "p2", armies: 0 }
      ])
    });

    const result = resolveConquest(
      state,
      {
        details: { playerId: "p1" },
        combat: {
          fromTerritoryId: "a",
          toTerritoryId: "b",
          attackDiceCount: Number.NaN,
          defenderReducedToZero: true
        }
      },
      1
    );

    assert.equal(result.ok, true);
    assert.equal(result.conquest.minimumMove, 1);
    assert.equal(state.territories.a.armies, 2);
    assert.equal(state.territories.b.armies, 1);
  }
);
