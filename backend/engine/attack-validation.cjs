const { TurnPhase } = require("../../shared/models.cjs");

function getCurrentPlayer(state) {
  if (!state || !Array.isArray(state.players) || state.players.length === 0) {
    return null;
  }

  return state.players[state.currentTurnIndex] || null;
}

function invalid(code, message, details = {}) {
  return {
    ok: false,
    code,
    message,
    details
  };
}

function valid(details = {}) {
  return {
    ok: true,
    code: "ATTACK_ALLOWED",
    message: "Attack is allowed.",
    details
  };
}

function validateAttackAttempt(state, graph, playerId, fromTerritoryId, toTerritoryId) {
  if (!state || typeof state !== "object") {
    throw new Error("Attack validation requires a valid game state.");
  }

  if (!graph || typeof graph.areAdjacent !== "function" || typeof graph.hasTerritory !== "function") {
    throw new Error("Attack validation requires a valid map graph.");
  }

  if (!playerId) {
    throw new Error("Attack validation requires a player id.");
  }

  if (!fromTerritoryId || !toTerritoryId) {
    throw new Error("Attack validation requires both attacker and defender territory ids.");
  }

  if (state.phase !== "active") {
    return invalid("GAME_NOT_ACTIVE", "Attacks are only allowed while the game is active.");
  }

  if (state.turnPhase !== TurnPhase.ATTACK) {
    return invalid("INVALID_PHASE", "Attacks are only allowed during the attack phase.", {
      turnPhase: state.turnPhase
    });
  }

  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) {
    return invalid("NOT_CURRENT_PLAYER", "Only the current player can attack.", {
      currentPlayerId: currentPlayer ? currentPlayer.id : null
    });
  }

  if (!graph.hasTerritory(fromTerritoryId)) {
    return invalid("UNKNOWN_ATTACKER_TERRITORY", `Unknown attacker territory "${fromTerritoryId}".`);
  }

  if (!graph.hasTerritory(toTerritoryId)) {
    return invalid("UNKNOWN_DEFENDER_TERRITORY", `Unknown defender territory "${toTerritoryId}".`);
  }

  const fromState = state.territories && state.territories[fromTerritoryId];
  const toState = state.territories && state.territories[toTerritoryId];

  if (!fromState) {
    return invalid("MISSING_ATTACKER_STATE", `Game state is missing attacker territory state for "${fromTerritoryId}".`);
  }

  if (!toState) {
    return invalid("MISSING_DEFENDER_STATE", `Game state is missing defender territory state for "${toTerritoryId}".`);
  }

  if (fromState.ownerId !== playerId) {
    return invalid("ATTACKER_NOT_OWNED", "The attacker territory must belong to the current player.", {
      ownerId: fromState.ownerId
    });
  }

  if (!toState.ownerId || toState.ownerId === playerId) {
    return invalid("DEFENDER_NOT_ENEMY", "The defender territory must belong to another player.", {
      ownerId: toState.ownerId
    });
  }

  if (!graph.areAdjacent(fromTerritoryId, toTerritoryId)) {
    return invalid("NOT_ADJACENT", "The attacker and defender territories must be adjacent.");
  }

  if (!Number.isFinite(fromState.armies) || fromState.armies < 2) {
    return invalid("INSUFFICIENT_ARMIES", "The attacker territory must contain at least 2 armies.", {
      armies: fromState.armies
    });
  }

  return valid({
    playerId,
    fromTerritoryId,
    toTerritoryId,
    attackerArmies: fromState.armies,
    defenderArmies: toState.armies,
    defenderOwnerId: toState.ownerId
  });
}

module.exports = {
  validateAttackAttempt
};
