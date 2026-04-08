const { TurnPhase, createLocalizedError } = require("../../shared/models.cjs");

function territoryCountByPlayer(state, playerId) {
  return Object.keys(state.territories).reduce((total, territoryId) => {
    const territory = state.territories[territoryId];
    return total + (territory && territory.ownerId === playerId ? 1 : 0);
  }, 0);
}

function isActivePlayer(state, player) {
  return Boolean(player && !player.surrendered && territoryCountByPlayer(state, player.id) > 0);
}

function validateState(state) {
  if (!state || typeof state !== "object") {
    throw createLocalizedError("Victory detection requires a valid game state.", "game.victory.internal.invalidState");
  }

  if (!Array.isArray(state.players) || state.players.length === 0) {
    throw createLocalizedError("Victory detection requires at least one player.", "game.victory.internal.noPlayers");
  }

  if (!state.territories || typeof state.territories !== "object") {
    throw createLocalizedError("Victory detection requires territory ownership data.", "game.victory.internal.missingTerritories");
  }
}

function finishGameState(state, winnerId) {
  state.winnerId = winnerId || null;
  state.phase = "finished";
  state.turnPhase = TurnPhase.FINISHED;
}

function aiOnlyRemain(state, activePlayers) {
  finishGameState(state, null);
  return {
    ok: true,
    code: "AI_ONLY_REMAIN",
    message: "Game closed because only AI players remain active.",
    messageKey: "game.victory.aiOnlyRemain",
    messageParams: {},
    details: {
      activePlayerIds: activePlayers.map((player) => player.id),
      activePlayerCount: activePlayers.length,
      activeHumanPlayerIds: [],
      activeHumanPlayerCount: 0
    },
    victory: null
  };
}

function pendingVictory(activePlayers) {
  return {
    ok: true,
    code: "NO_VICTORY",
    message: "Victory has not been determined yet.",
    messageKey: "game.victory.pending",
    messageParams: {},
    details: {
      activePlayerIds: activePlayers.map((player) => player.id),
      activePlayerCount: activePlayers.length
    },
    victory: null
  };
}

function declaredVictory(state, winner, summary, summaryKey = "game.log.victoryDeclared", summaryParams = { playerName: winner.name }) {
  finishGameState(state, winner.id);
  return {
    ok: true,
    code: "VICTORY_DECLARED",
    message: "Victory declared.",
    messageKey: "game.victory.declared",
    messageParams: { playerName: winner.name },
    details: {
      activePlayerIds: [winner.id],
      activePlayerCount: 1
    },
    victory: {
      winnerId: winner.id,
      winnerName: winner.name,
      phase: state.phase,
      turnPhase: state.turnPhase,
      summary,
      summaryKey,
      summaryParams
    }
  };
}

function resolveDominationVictory(state, activePlayers) {
  if (activePlayers.length > 1) {
    return pendingVictory(activePlayers);
  }

  const winner = activePlayers[0];
  return declaredVictory(state, winner, `${winner.name} conquers the map and wins the game.`);
}

function resolveCaptureTerritoriesVictory(state, activePlayers, config = {}) {
  const targetTerritoryCount = Math.max(1, Number(config.targetTerritoryCount) || 18);
  const winner = activePlayers.find((player) => territoryCountByPlayer(state, player.id) >= targetTerritoryCount);
  if (!winner) {
    return pendingVictory(activePlayers);
  }

  return declaredVictory(
    state,
    winner,
    `${winner.name} controls ${targetTerritoryCount} territories and wins the game.`,
    "game.log.victoryDeclared",
    { playerName: winner.name }
  );
}

function evaluateVictoryRule(state, victoryRule) {
  validateState(state);

  const activePlayers = state.players.filter((player) => isActivePlayer(state, player));
  if (activePlayers.length === 0) {
    throw createLocalizedError(
      "Victory detection found no active players with territories.",
      "game.victory.internal.noActivePlayers"
    );
  }

  const activeHumanPlayers = activePlayers.filter((player) => !player.isAi);
  if (activeHumanPlayers.length === 0) {
    return aiOnlyRemain(state, activePlayers);
  }

  const moduleId = String(victoryRule?.moduleId || "domination");
  if (moduleId === "capture-territories") {
    return resolveCaptureTerritoriesVictory(state, activePlayers, victoryRule?.config || {});
  }

  return resolveDominationVictory(state, activePlayers);
}

module.exports = {
  evaluateVictoryRule,
  territoryCountByPlayer
};
