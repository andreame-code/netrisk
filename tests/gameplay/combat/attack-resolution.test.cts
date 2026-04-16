const assert = require("node:assert/strict");
const { resolveAttack, TurnPhase } = require("../../../backend/engine/game-engine.cjs");
const { createFixedRandom, rollsToRandomValues } = require("../helpers/random.cjs");
const { makePlayers, makeState, territoryStates } = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function setupAttackState() {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "aurora", ownerId: "p1", armies: 5 },
      { id: "bastion", ownerId: "p2", armies: 1 }
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

register("resolveAttack applica il minimo movimento modulare dopo una conquista", () => {
  const state = setupAttackState();
  state.gameConfig = {
    ...(state.gameConfig || {}),
    gameplayEffects: {
      conquestMinimumArmies: 2
    }
  };
  const random = createFixedRandom(rollsToRandomValues([6, 1]));

  const result = resolveAttack(state, "p1", "aurora", "bastion", random, 1);

  assert.equal(result.ok, true);
  assert.equal(state.pendingConquest?.toId, "bastion");
  assert.equal(state.pendingConquest?.minArmies, 2);
  assert.equal(state.pendingConquest?.maxArmies, 4);
});

register("resolveAttack clampa il minimo movimento modulare alla disponibilita reale", () => {
  const state = setupAttackState();
  state.territories.aurora.armies = 3;
  state.gameConfig = {
    ...(state.gameConfig || {}),
    gameplayEffects: {
      conquestMinimumArmies: 4
    }
  };
  const random = createFixedRandom(rollsToRandomValues([6, 1]));

  const result = resolveAttack(state, "p1", "aurora", "bastion", random, 1);

  assert.equal(result.ok, true);
  assert.equal(state.pendingConquest?.maxArmies, 2);
  assert.equal(state.pendingConquest?.minArmies, 2);
});

register("resolveAttack applica il minimo modulare per iniziare un attacco", () => {
  const state = setupAttackState();
  state.territories.aurora.armies = 2;
  state.gameConfig = {
    ...(state.gameConfig || {}),
    gameplayEffects: {
      attackMinimumArmies: 3
    }
  };

  const result = resolveAttack(state, "p1", "aurora", "bastion");

  assert.equal(result.ok, false);
  assert.equal(result.messageKey, "game.attack.minArmies");
  assert.deepEqual(result.messageParams, { minArmies: 3 });
});

register("resolveAttack incrementa il contatore e blocca attacchi oltre il limite turno", () => {
  const state = setupAttackState();
  state.territories.bastion.armies = 3;
  state.gameConfig = {
    ...(state.gameConfig || {}),
    gameplayEffects: {
      attackLimitPerTurn: 1
    }
  };

  const firstAttack = resolveAttack(
    state,
    "p1",
    "aurora",
    "bastion",
    createFixedRandom(rollsToRandomValues([6, 1])),
    1
  );
  assert.equal(firstAttack.ok, true);
  assert.equal(state.attacksThisTurn, 1);
  assert.equal(state.pendingConquest, null);

  const blockedAttack = resolveAttack(
    state,
    "p1",
    "aurora",
    "bastion",
    createFixedRandom(rollsToRandomValues([6, 1])),
    1
  );
  assert.equal(blockedAttack.ok, false);
  assert.equal(blockedAttack.messageKey, "game.attack.limitReached");
  assert.deepEqual(blockedAttack.messageParams, {
    attackLimitPerTurn: 1,
    attacksThisTurn: 1
  });
});
