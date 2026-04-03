const { GameAction, TurnPhase } = require("../../shared/models.cjs");

function getCurrentPlayer(state) {
  if (!state || !Array.isArray(state.players) || state.players.length === 0) {
    return null;
  }

  return state.players[state.currentTurnIndex] || null;
}

function validateState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("Reinforcement placement requires a valid game state.");
  }

  if (state.phase !== "active") {
    throw new Error("Reinforcements can only be placed while the game is active.");
  }

  if (state.turnPhase !== TurnPhase.REINFORCEMENT) {
    throw new Error("Reinforcements can only be placed during the reinforcement phase.");
  }

  if (!Array.isArray(state.players) || state.players.length === 0) {
    throw new Error("Game state must contain players for reinforcement placement.");
  }

  if (!state.territories || typeof state.territories !== "object") {
    throw new Error("Game state must contain territories for reinforcement placement.");
  }

  if (!Number.isInteger(state.currentTurnIndex) || state.currentTurnIndex < 0 || state.currentTurnIndex >= state.players.length) {
    throw new Error("Game state has an invalid currentTurnIndex for reinforcement placement.");
  }

  if (!Number.isFinite(state.reinforcementPool)) {
    throw new Error("Game state has an invalid reinforcement pool.");
  }
}

function placeReinforcement(state, playerId, territoryId) {
  validateState(state);

  if (!playerId) {
    throw new Error("Reinforcement placement requires a player id.");
  }

  if (!territoryId) {
    throw new Error("Reinforcement placement requires a territory id.");
  }

  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Only the current player can place reinforcements.");
  }

  if (state.reinforcementPool <= 0) {
    throw new Error("No reinforcements are available to place.");
  }

  const territoryState = state.territories[territoryId];
  if (!territoryState) {
    throw new Error(`Unknown territory "${territoryId}" for reinforcement placement.`);
  }

  if (territoryState.ownerId !== playerId) {
    throw new Error(`Player "${playerId}" can only place reinforcements on owned territories.`);
  }

  territoryState.armies += 1;
  state.reinforcementPool -= 1;
  state.lastAction = {
    type: GameAction.REINFORCE,
    playerId,
    territoryId,
    summary: `${currentPlayer.name} places 1 reinforcement on ${territoryId}.`
  };

  return {
    playerId,
    territoryId,
    remainingReinforcements: state.reinforcementPool,
    territoryArmies: territoryState.armies,
    turnPhase: state.turnPhase
  };
}

module.exports = {
  placeReinforcement
};
