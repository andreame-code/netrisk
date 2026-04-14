const { forceEndTurn, getCurrentPlayer } = require("../engine/game-engine.cjs") as typeof import("../engine/game-engine.cjs");
const { runAiTurnsIfNeeded } = require("../engine/ai-turn-resume.cjs") as typeof import("../engine/ai-turn-resume.cjs");

type EngineState = Parameters<typeof forceEndTurn>[0];

type RecoverableAiState = {
  phase?: string;
  turnPhase?: string;
  winnerId?: string | null;
  currentTurnIndex?: number;
  turnStartedAt?: string | null;
  pendingConquest?: {
    fromId?: string;
    toId?: string;
    minArmies?: number;
    maxArmies?: number;
  } | null;
};

type GameEntry = {
  id: string;
  name: string;
  version?: number | null;
  state: Record<string, unknown>;
};

type VersionConflictError = Error & {
  code?: string;
};

type AiTurnSnapshot = {
  currentTurnIndex: number;
  currentPlayerId: string;
  turnStartedAt: string | null;
  turnPhase: string | null;
  pendingConquestKey: string | null;
};

export interface RecoverAiTurnStateResult {
  eligible: boolean;
  attempted: boolean;
  advanced: boolean;
  forcedTurn: boolean;
  interceptedError: boolean;
  shouldPersist: boolean;
  reports: unknown[];
}

export interface AiTurnRecoveryJobResult {
  scannedGames: number;
  eligibleGames: number;
  recoveryAttempts: number;
  recoveredGames: number;
  forcedTurns: number;
  interceptedErrors: number;
  skippedConflicts: number;
}

function pendingConquestKey(state: RecoverableAiState): string | null {
  const pending = state?.pendingConquest;
  if (!pending) {
    return null;
  }

  return JSON.stringify({
    fromId: pending.fromId || null,
    toId: pending.toId || null,
    minArmies: Number(pending.minArmies) || 0,
    maxArmies: Number(pending.maxArmies) || 0
  });
}

function captureAiTurnSnapshot(state: RecoverableAiState): AiTurnSnapshot | null {
  if (!state || state.phase !== "active" || state.winnerId) {
    return null;
  }

  const currentPlayer = getCurrentPlayer(state as Parameters<typeof getCurrentPlayer>[0]);
  if (!currentPlayer?.isAi || !currentPlayer.id || !Number.isInteger(state.currentTurnIndex)) {
    return null;
  }

  const currentTurnIndex = Number(state.currentTurnIndex);

  return {
    currentTurnIndex,
    currentPlayerId: currentPlayer.id,
    turnStartedAt: typeof state.turnStartedAt === "string" && state.turnStartedAt.trim() ? state.turnStartedAt : null,
    turnPhase: typeof state.turnPhase === "string" ? state.turnPhase : null,
    pendingConquestKey: pendingConquestKey(state)
  };
}

function sameAiTurnSnapshot(left: AiTurnSnapshot | null, right: AiTurnSnapshot | null): boolean {
  if (!left || !right) {
    return false;
  }

  return left.currentTurnIndex === right.currentTurnIndex
    && left.currentPlayerId === right.currentPlayerId
    && left.turnStartedAt === right.turnStartedAt
    && left.turnPhase === right.turnPhase
    && left.pendingConquestKey === right.pendingConquestKey;
}

export async function recoverAiTurnState(
  state: Record<string, unknown>,
  options: {
    now?: Date;
    forceEndTurn?: typeof forceEndTurn;
    runAiTurnsIfNeeded?: typeof runAiTurnsIfNeeded;
  } = {}
): Promise<RecoverAiTurnStateResult> {
  const snapshotBefore = captureAiTurnSnapshot(state as RecoverableAiState);
  if (!snapshotBefore) {
    return {
      eligible: false,
      attempted: false,
      advanced: false,
      forcedTurn: false,
      interceptedError: false,
      shouldPersist: false,
      reports: []
    };
  }

  const executeAiTurns = options.runAiTurnsIfNeeded || runAiTurnsIfNeeded;
  const executeForceEndTurn = options.forceEndTurn || forceEndTurn;

  let reports: unknown[] = [];
  let interceptedError = false;

  try {
    const nextReports = await Promise.resolve(executeAiTurns(state as unknown as Parameters<typeof runAiTurnsIfNeeded>[0]));
    reports = Array.isArray(nextReports) ? nextReports : [];
  } catch (error) {
    interceptedError = true;
  }

  const snapshotAfter = captureAiTurnSnapshot(state as RecoverableAiState);
  const advanced = !snapshotAfter || !sameAiTurnSnapshot(snapshotBefore, snapshotAfter);

  if (advanced) {
    return {
      eligible: true,
      attempted: true,
      advanced: true,
      forcedTurn: false,
      interceptedError,
      shouldPersist: interceptedError || reports.length > 0 || !sameAiTurnSnapshot(snapshotBefore, snapshotAfter),
      reports
    };
  }

  const currentPlayer = getCurrentPlayer(state as unknown as Parameters<typeof getCurrentPlayer>[0]);
  if (!currentPlayer?.id || currentPlayer.id !== snapshotBefore.currentPlayerId) {
    return {
      eligible: true,
      attempted: true,
      advanced: true,
      forcedTurn: false,
      interceptedError,
      shouldPersist: interceptedError || reports.length > 0,
      reports
    };
  }

  const forcedResult = executeForceEndTurn(state as unknown as EngineState, snapshotBefore.currentPlayerId, {
    reason: "aiRecovery",
    now: options.now
  });

  if (forcedResult.ok !== true) {
    throw new Error((forcedResult as { message?: string }).message || "Impossibile forzare il turno AI bloccato.");
  }

  return {
    eligible: true,
    attempted: true,
    advanced: true,
    forcedTurn: true,
    interceptedError,
    shouldPersist: true,
    reports
  };
}

export async function recoverStuckAiTurns(
  options: {
    listGames: () => Promise<GameEntry[]> | GameEntry[];
    saveGame: (gameId: string, state: Record<string, unknown>, expectedVersion?: number | null) => Promise<unknown> | unknown;
    afterSave?: (payload: { gameId: string; gameName: string; state: Record<string, unknown>; version: number | null }) => Promise<void> | void;
    now?: Date;
    forceEndTurn?: typeof forceEndTurn;
    runAiTurnsIfNeeded?: typeof runAiTurnsIfNeeded;
  }
): Promise<AiTurnRecoveryJobResult> {
  const entries = await options.listGames();
  const result: AiTurnRecoveryJobResult = {
    scannedGames: entries.length,
    eligibleGames: 0,
    recoveryAttempts: 0,
    recoveredGames: 0,
    forcedTurns: 0,
    interceptedErrors: 0,
    skippedConflicts: 0
  };

  for (const entry of entries) {
    const snapshotBefore = captureAiTurnSnapshot(entry.state as RecoverableAiState);
    if (!snapshotBefore) {
      continue;
    }

    result.eligibleGames += 1;

    const recovery = await recoverAiTurnState(entry.state, {
      now: options.now,
      forceEndTurn: options.forceEndTurn,
      runAiTurnsIfNeeded: options.runAiTurnsIfNeeded
    });

    if (!recovery.attempted) {
      continue;
    }

    result.recoveryAttempts += 1;
    if (recovery.interceptedError) {
      result.interceptedErrors += 1;
    }

    if (!recovery.shouldPersist) {
      continue;
    }

    try {
      const savedGame = await options.saveGame(entry.id, entry.state, entry.version ?? null) as { version?: number | null } | null;
      const version = savedGame?.version ?? entry.version ?? null;
      result.recoveredGames += 1;
      if (recovery.forcedTurn) {
        result.forcedTurns += 1;
      }

      if (options.afterSave) {
        await options.afterSave({
          gameId: entry.id,
          gameName: entry.name,
          state: entry.state,
          version
        });
      }
    } catch (error) {
      const conflict = error as VersionConflictError;
      if (conflict?.code === "VERSION_CONFLICT") {
        result.skippedConflicts += 1;
        continue;
      }
      throw error;
    }
  }

  return result;
}

module.exports = {
  recoverAiTurnState,
  recoverStuckAiTurns
};
