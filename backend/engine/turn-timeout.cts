import { normalizeTurnTimeoutHours, type TurnTimeoutHoursValue } from "../../shared/turn-timeouts.cjs";
import type { GameState } from "../../shared/models.cjs";

type TimeoutAwareGameState = GameState & {
  gameConfig?: {
    turnTimeoutHours?: unknown;
  } | null;
};

export interface ExpiredTurn {
  currentPlayerId: string;
  turnStartedAt: string;
  turnTimeoutHours: TurnTimeoutHoursValue;
  elapsedMilliseconds: number;
}

export function resolveTurnTimeoutHours(state: TimeoutAwareGameState): TurnTimeoutHoursValue | null {
  return normalizeTurnTimeoutHours(state?.gameConfig?.turnTimeoutHours);
}

export function resolveTurnStartDate(state: TimeoutAwareGameState): Date | null {
  if (typeof state?.turnStartedAt !== "string" || !state.turnStartedAt.trim()) {
    return null;
  }

  const date = new Date(state.turnStartedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function findExpiredTurn(state: TimeoutAwareGameState, now: Date = new Date()): ExpiredTurn | null {
  if (!state || state.phase !== "active") {
    return null;
  }

  const timeoutHours = resolveTurnTimeoutHours(state);
  if (timeoutHours == null) {
    return null;
  }

  if (!Array.isArray(state.players) || !Number.isInteger(state.currentTurnIndex)) {
    return null;
  }

  const currentPlayer = state.players[state.currentTurnIndex];
  if (!currentPlayer?.id) {
    return null;
  }

  const turnStartDate = resolveTurnStartDate(state);
  if (!turnStartDate) {
    return null;
  }

  const elapsedMilliseconds = now.getTime() - turnStartDate.getTime();
  if (elapsedMilliseconds <= timeoutHours * 60 * 60 * 1000) {
    return null;
  }

  return {
    currentPlayerId: currentPlayer.id,
    turnStartedAt: turnStartDate.toISOString(),
    turnTimeoutHours: timeoutHours,
    elapsedMilliseconds
  };
}
