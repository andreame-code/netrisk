const { TurnPhase, createLocalizedError, findVictoryRule } = require("../../shared/models.cjs");
const { applyRuleHook } = require("./rule-modules/index.cjs");

function territoryCountByPlayer(state, playerId) {
  return Object.keys(state.territories).reduce((total, territoryId) => {
    const territory = state.territories[territoryId];
    return total + (territory && territory.ownerId === playerId ? 1 : 0);
  }, 0);
}

function isActivePlayer(state, player) {
  return Boolean(player && !player.surrendered && territoryCountByPlayer(state, player.id) > 0);
}

function isActiveHumanPlayer(player) {
  return Boolean(player && !player.isAi);
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

  const playerIds = new Set();
  state.players.forEach((player, index) => {
    if (!player || !player.id) {
      throw createLocalizedError(
        `Victory detection found an invalid player at index ${index}.`,
        "game.victory.internal.invalidPlayer",
        { index }
      );
    }

    if (playerIds.has(player.id)) {
      throw createLocalizedError(
        `Victory detection found duplicate player id "${player.id}".`,
        "game.victory.internal.duplicatePlayer",
        { playerId: player.id }
      );
    }

    playerIds.add(player.id);
  });
}

function detectVictory(state) {
  validateState(state);

  const activePlayers = state.players.filter((player) => isActivePlayer(state, player));
  if (activePlayers.length === 0) {
    throw createLocalizedError(
      "Victory detection found no active players with territories.",
      "game.victory.internal.noActivePlayers"
    );
  }

  const activeHumanPlayers = activePlayers.filter((player) => isActiveHumanPlayer(player));
  if (activeHumanPlayers.length === 0) {
    state.winnerId = null;
    state.phase = "finished";
    state.turnPhase = TurnPhase.FINISHED;

    const summary = "La partita si chiude: restano attive solo AI.";
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

  if (activePlayers.length > 1) {
    const configuredVictoryRuleId = state?.gameModeDefinition?.victoryRuleId || "standard-elimination";
    if (configuredVictoryRuleId !== "standard-elimination") {
      const configuredVictoryRule = findVictoryRule(configuredVictoryRuleId);
      const setupOptions = state?.gameModeDefinition?.setupOptions || {};

      if (configuredVictoryRule?.id === "territory-control") {
        const targetTerritoryCount = Number(setupOptions.targetTerritoryCount);
        if (Number.isInteger(targetTerritoryCount) && targetTerritoryCount > 0) {
          const winner = activePlayers.find((player) => territoryCountByPlayer(state, player.id) >= targetTerritoryCount) || null;
          if (winner) {
            state.winnerId = winner.id;
            state.phase = "finished";
            state.turnPhase = TurnPhase.FINISHED;

            const objectiveResult = {
              ok: true,
              code: "VICTORY_DECLARED",
              message: "Victory declared.",
              messageKey: "game.victory.declared",
              messageParams: { playerName: winner.name },
              details: {
                activePlayerIds: activePlayers.map((player) => player.id),
                activePlayerCount: activePlayers.length,
                targetTerritoryCount
              },
              victory: {
                winnerId: winner.id,
                winnerName: winner.name,
                phase: state.phase,
                turnPhase: state.turnPhase,
                summary: winner.name + " completa l'obiettivo e vince la partita.",
                summaryKey: "game.log.victoryDeclared",
                summaryParams: {
                  playerName: winner.name
                }
              }
            };

            applyRuleHook(state, "onCheckVictory", {
              result: objectiveResult
            });

            return objectiveResult;
          }
        }
      }
    }

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

  const winner = activePlayers[0];
  state.winnerId = winner.id;
  state.phase = "finished";
  state.turnPhase = TurnPhase.FINISHED;

  const summary = winner.name + " conquers the map and wins the game.";
  const result = {
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
      summaryKey: "game.log.victoryDeclared",
      summaryParams: {
        playerName: winner.name
      }
    }
  };

  applyRuleHook(state, "onCheckVictory", {
    result
  });

  return result;
}

module.exports = {
  detectVictory
};
