// @ts-nocheck
const assert = require("node:assert/strict");
const { resolveBanzaiAttack } = require("../../../backend/engine/banzai-attack.cjs");
const { createFixedRandom, rollsToRandomValues } = require("../helpers/random.cjs");
const { makePlayers, makeState, territoryStates, TurnPhase } = require("../helpers/state-builder.cjs");

function setupBanzaiState() {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "aurora", ownerId: "p1", armies: 5 },
      { id: "bastion", ownerId: "p2", armies: 3 }
    ]),
    turnPhase: TurnPhase.ATTACK,
    currentTurnIndex: 0
  });
  state.mapTerritories = [
    { id: "aurora", name: "Aurora", neighbors: ["bastion"], continentId: null },
    { id: "bastion", name: "Bastion", neighbors: ["aurora"], continentId: null }
  ];
  return state;
}

register("resolveBanzaiAttack loops server-side until conquest and returns synthetic rounds", () => {
  const state = setupBanzaiState();
  const random = createFixedRandom(
    rollsToRandomValues([
      6, 1, 1, 5, 2,
      6, 1, 1, 5, 2,
      6, 5, 1
    ])
  );

  const result = resolveBanzaiAttack(state, "p1", "aurora", "bastion", random, 3);

  assert.equal(result.ok, true);
  assert.equal(result.rounds.length, 3);
  assert.deepEqual(result.rounds.map((round) => round.round), [1, 2, 3]);
  assert.deepEqual(result.rounds.map((round) => round.defenderArmiesRemaining), [2, 1, 0]);
  assert.deepEqual(result.rounds.map((round) => round.attackerArmiesRemaining), [4, 3, 3]);
  assert.equal(result.rounds[2].conqueredTerritory, true);
  assert.equal(result.pendingConquest.fromId, "aurora");
  assert.equal(result.pendingConquest.toId, "bastion");
  assert.equal(state.pendingConquest.toId, "bastion");
  assert.equal(state.territories.bastion.ownerId, "p1");
});

register("resolveBanzaiAttack normalizes attack dice as armies drop", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "aurora", ownerId: "p1", armies: 5 },
      { id: "bastion", ownerId: "p2", armies: 2 }
    ]),
    turnPhase: TurnPhase.ATTACK,
    currentTurnIndex: 0
  });
  state.mapTerritories = [
    { id: "aurora", name: "Aurora", neighbors: ["bastion"], continentId: null },
    { id: "bastion", name: "Bastion", neighbors: ["aurora"], continentId: null }
  ];
  const random = createFixedRandom(
    rollsToRandomValues([
      1, 1, 6, 6, 1,
      6, 5, 1, 1
    ])
  );

  const result = resolveBanzaiAttack(state, "p1", "aurora", "bastion", random, 3);

  assert.equal(result.ok, true);
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[0].attackDiceCount, 3);
  assert.equal(result.rounds[1].attackDiceCount, 2);
  assert.equal(result.rounds[1].conqueredTerritory, true);
  assert.equal(state.territories.aurora.armies, 3);
  assert.equal(state.territories.bastion.armies, 0);
  assert.equal(state.pendingConquest.toId, "bastion");
});

