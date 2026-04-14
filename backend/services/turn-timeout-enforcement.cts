import { findExpiredTurn } from "../engine/turn-timeout.cjs";

type ForceEndTurn = typeof import("../engine/game-engine.cjs").forceEndTurn;
type RecoverAiTurnState = typeof import("./ai-turn-recovery.cjs").recoverAiTurnState;

type GameEntry = {
  id: string;
  name: string;
  version?: number | null;
  state: Record<string, unknown>;
};

type VersionConflictError = Error & {
  code?: string;
};

export interface TurnTimeoutEnforcementResult {
  scannedGames: number;
  eligibleGames: number;
  expiredGames: number;
  forcedTurns: number;
  skippedConflicts: number;
}

export async function enforceTurnTimeouts(
  options: {
    listGames: () => Promise<GameEntry[]> | GameEntry[];
    saveGame: (gameId: string, state: Record<string, unknown>, expectedVersion?: number | null) => Promise<unknown> | unknown;
    forceEndTurn: ForceEndTurn;
    recoverAiTurnState?: RecoverAiTurnState;
    afterSave?: (payload: { gameId: string; gameName: string; state: Record<string, unknown>; version: number | null }) => Promise<void> | void;
    now?: Date;
  }
): Promise<TurnTimeoutEnforcementResult> {
  const entries = await options.listGames();
  const result: TurnTimeoutEnforcementResult = {
    scannedGames: entries.length,
    eligibleGames: 0,
    expiredGames: 0,
    forcedTurns: 0,
    skippedConflicts: 0
  };

  for (const entry of entries) {
    const expiredTurn = findExpiredTurn(entry.state as unknown as Parameters<typeof findExpiredTurn>[0], options.now);
    if (!expiredTurn) {
      continue;
    }

    result.eligibleGames += 1;
    result.expiredGames += 1;

    const forceResult = options.forceEndTurn(entry.state as unknown as Parameters<ForceEndTurn>[0], expiredTurn.currentPlayerId, {
      reason: "timeout",
      turnTimeoutHours: expiredTurn.turnTimeoutHours,
      now: options.now
    });
    if (forceResult.ok !== true) {
      throw new Error((forceResult as { message?: string }).message || `Impossibile forzare il turno della partita ${entry.id}.`);
    }

    try {
      const savedGame = await options.saveGame(entry.id, entry.state, entry.version ?? null) as { version?: number | null } | null;
      let finalVersion = savedGame?.version ?? entry.version ?? null;
      result.forcedTurns += 1;

      if (options.recoverAiTurnState) {
        const aiRecovery = await options.recoverAiTurnState(entry.state, {
          now: options.now,
          forceEndTurn: options.forceEndTurn
        });
        if (aiRecovery.shouldPersist) {
          const postAiSave = await options.saveGame(entry.id, entry.state, finalVersion);
          finalVersion = (postAiSave as { version?: number | null } | null)?.version ?? finalVersion;
        }
      }

      if (options.afterSave) {
        await options.afterSave({
          gameId: entry.id,
          gameName: entry.name,
          state: entry.state,
          version: finalVersion
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
