import {
  DEFAULT_VICTORY_RULE_SET_ID,
  TurnPhase,
  createLocalizedError,
  getVictoryRuleSet,
  migrateGameStateExtensions,
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
  migrateGameStateExtensions(state);
  validateState(state);
  const victoryRuleSetId = state.gameConfig?.victoryRuleSetId || DEFAULT_VICTORY_RULE_SET_ID;
  const victoryRuleSet = getVictoryRuleSet(victoryRuleSetId);

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

  const winner = activePlayers[0] as Player;
  state.winnerId = winner.id;
  state.phase = "finished";
  state.turnPhase = TurnPhase.FINISHED;

  const summary = winner.name + " conquers the map and wins the game.";
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
      summaryKey: "game.log.victoryDeclared",
      summaryParams: {
        playerName: winner.name,
        victoryRuleSet: victoryRuleSet.name
      }
    }
  };
}
