const { TurnPhase } = require("../../shared/models.cjs");

function territoryCountByPlayer(state, playerId) {
  return Object.keys(state.territories).reduce((total, territoryId) => {
    const territory = state.territories[territoryId];
    return total + (territory && territory.ownerId === playerId ? 1 : 0);
  }, 0);
}

function validateState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("Victory detection requires a valid game state.");
  }

  if (!Array.isArray(state.players) || state.players.length === 0) {
    throw new Error("Victory detection requires at least one player.");
  }

  if (!state.territories || typeof state.territories !== "object") {
    throw new Error("Victory detection requires territory ownership data.");
  }

  const playerIds = new Set();
  state.players.forEach((player, index) => {
    if (!player || !player.id) {
      throw new Error(`Victory detection found an invalid player at index ${index}.`);
    }

    if (playerIds.has(player.id)) {
      throw new Error(`Victory detection found duplicate player id "${player.id}".`);
    }

    playerIds.add(player.id);
  });
}

function detectVictory(state, options = {}) {
  validateState(state);

  const activePlayers = state.players.filter((player) => territoryCountByPlayer(state, player.id) > 0);
  if (activePlayers.length === 0) {
    throw new Error("Victory detection found no active players with territories.");
  }

  if (activePlayers.length > 1) {
    return {
      ok: true,
      code: "NO_VICTORY",
      message: "Victory has not been determined yet.",
      details: {
        activePlayerIds: activePlayers.map((player) => player.id),
        activePlayerCount: activePlayers.length
      },
      victory: null
    };
  }

  const winner = activePlayers[0];
  state.winnerId = winner.id;
  state.phase = "finished";
  state.turnPhase = TurnPhase.FINISHED;

  const summary = winner.name + " conquers the map and wins the game.";
  if (typeof options.appendLog === "function") {
    options.appendLog(summary);
  }

  return {
    ok: true,
    code: "VICTORY_DECLARED",
    message: "Victory declared.",
    details: {
      activePlayerIds: [winner.id],
      activePlayerCount: 1
    },
    victory: {
      winnerId: winner.id,
      winnerName: winner.name,
      phase: state.phase,
      turnPhase: state.turnPhase,
      summary
    }
  };
}

module.exports = {
  detectVictory
};
