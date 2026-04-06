const { getDiceRuleSet } = require("../../shared/dice.cjs");
const { resolveAttack } = require("./game-engine.cjs");

function buildBanzaiRound(roundIndex, combat) {
  return {
    round: roundIndex,
    fromTerritoryId: combat.fromTerritoryId,
    toTerritoryId: combat.toTerritoryId,
    attackDiceCount: combat.attackDiceCount,
    defendDiceCount: combat.defendDiceCount,
    attackerRolls: combat.attackerRolls,
    defenderRolls: combat.defenderRolls,
    comparisons: combat.comparisons,
    attackerArmiesBefore: combat.attackerArmiesBefore,
    defenderArmiesBefore: combat.defenderArmiesBefore,
    attackerArmiesRemaining: combat.attackerArmiesRemaining,
    defenderArmiesRemaining: combat.defenderArmiesRemaining,
    defenderReducedToZero: Boolean(combat.defenderReducedToZero),
    conqueredTerritory: Boolean(combat.conqueredTerritory)
  };
}

function normalizeRequestedAttackDice(state, fromId, requestedAttackDice) {
  if (requestedAttackDice == null) {
    return null;
  }

  const from = state?.territories?.[fromId];
  if (!from) {
    return requestedAttackDice;
  }

  const diceRuleSet = getDiceRuleSet(state.diceRuleSetId || "standard");
  const attackerReserve = diceRuleSet.attackerMustLeaveOneArmyBehind ? 1 : 0;
  const maxAttackDice = Math.max(0, Math.min(diceRuleSet.attackerMaxDice, from.armies - attackerReserve));
  if (maxAttackDice < 1) {
    return requestedAttackDice;
  }

  return Math.min(requestedAttackDice, maxAttackDice);
}

function canContinueBanzai(state, playerId, fromId, toId) {
  const from = state?.territories?.[fromId];
  const to = state?.territories?.[toId];
  if (!from || !to) {
    return false;
  }

  if (state.pendingConquest) {
    return false;
  }

  if (from.armies <= 1) {
    return false;
  }

  return to.ownerId !== playerId;
}

function resolveBanzaiAttack(state, playerId, fromId, toId, random, requestedAttackDice = null) {
  const rounds = [];
  const initialResult = resolveAttack(
    state,
    playerId,
    fromId,
    toId,
    random,
    normalizeRequestedAttackDice(state, fromId, requestedAttackDice)
  );
  if (!initialResult.ok) {
    return initialResult;
  }

  rounds.push(buildBanzaiRound(1, initialResult.combat));
  let latestResult = initialResult;

  while (canContinueBanzai(state, playerId, fromId, toId)) {
    const nextResult = resolveAttack(
      state,
      playerId,
      fromId,
      toId,
      random,
      normalizeRequestedAttackDice(state, fromId, requestedAttackDice)
    );
    if (!nextResult.ok) {
      break;
    }

    rounds.push(buildBanzaiRound(rounds.length + 1, nextResult.combat));
    latestResult = nextResult;
  }

  return {
    ...latestResult,
    rounds
  };
}

module.exports = {
  resolveBanzaiAttack
};
