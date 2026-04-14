import {
  TurnPhase,
  createLocalizedError,
  getVictoryRuleSet,
  STANDARD_VICTORY_RULE_SET_ID,
  type GameState,
  type Player
} from "../../shared/models.cjs";

export interface VictoryResult {
  ok: true;
  code: string;
  message: string;
  messageKey: string;
  messageParams: Record<string, unknown>;
  details: {
    activePlayerIds: Array<string | null>;
    activePlayerCount: number;
    activeHumanPlayerIds?: Array<string | null>;
    activeHumanPlayerCount?: number;
  };
  victory: {
    winnerId: string | null;
    winnerName: string;
    phase: string;
    turnPhase: string;
    summary: string;
    summaryKey: string;
    summaryParams: Record<string, unknown>;
  } | null;
}

function territoryCountByPlayer(state: GameState, playerId: string | null): number {
  return Object.keys(state.territories).reduce((total, territoryId) => {
    const territory = state.territories[territoryId];
    return total + (territory && territory.ownerId === playerId ? 1 : 0);
  }, 0);
}

function isActivePlayer(state: GameState, player: Player): boolean {
  return Boolean(player && !player.surrendered && territoryCountByPlayer(state, player.id) > 0);
}

function isActiveHumanPlayer(player: Player): boolean {
  return Boolean(player && !player.isAi);
}

function validateState(state: GameState): void {
  if (!state || typeof state !== "object") {
    throw createLocalizedError("Victory detection requires a valid game state.", "game.victory.internal.invalidState");
  }

  if (!Array.isArray(state.players) || state.players.length === 0) {
    throw createLocalizedError("Victory detection requires at least one player.", "game.victory.internal.noPlayers");
  }

  if (!state.territories || typeof state.territories !== "object") {
    throw createLocalizedError("Victory detection requires territory ownership data.", "game.victory.internal.missingTerritories");
  }

  const playerIds = new Set<string>();
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

export function detectVictory(state: GameState): VictoryResult {
  validateState(state);

  const activePlayers = state.players.filter((player) => isActivePlayer(state, player));
  if (activePlayers.length === 0) {
    throw createLocalizedError(
      "Victory detection found no active players with territories.",
      "game.victory.internal.noActivePlayers"
    );
  }

  const activeHumanPlayers = activePlayers.filter((player) => isActiveHumanPlayer(player));
  const victoryRuleSet = getVictoryRuleSet(state.victoryRuleSetId || STANDARD_VICTORY_RULE_SET_ID);
  const resolution = victoryRuleSet.resolve(state, {
    activePlayers,
    activeHumanPlayers
  });

  if (resolution.shouldFinishGame) {
    state.winnerId = resolution.winnerId;
    state.phase = "finished";
    state.turnPhase = TurnPhase.FINISHED;
  }

  return {
    ok: true,
    code: resolution.code,
    message: resolution.message,
    messageKey: resolution.messageKey,
    messageParams: resolution.messageParams,
    details: {
      activePlayerIds: activePlayers.map((player) => player.id),
      activePlayerCount: activePlayers.length,
      activeHumanPlayerIds: activeHumanPlayers.map((player) => player.id),
      activeHumanPlayerCount: activeHumanPlayers.length
    },
    victory: resolution.shouldFinishGame && resolution.winnerId && resolution.winnerName && resolution.summary
      ? {
          winnerId: resolution.winnerId,
          winnerName: resolution.winnerName,
          phase: state.phase,
          turnPhase: state.turnPhase,
          summary: resolution.summary,
          summaryKey: resolution.summaryKey || "game.log.victoryDeclared",
          summaryParams: resolution.summaryParams
        }
      : null
  };
}
