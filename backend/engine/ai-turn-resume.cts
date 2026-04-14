const {
  advanceTurn,
  getCurrentPlayer,
  territoriesOwnedBy
} = require("./game-engine.cjs") as typeof import("./game-engine.cjs");
const { runAiTurn } = require("./ai-player.cjs") as typeof import("./ai-player.cjs");
const { createLocalizedError } = require("../../shared/messages.cjs") as typeof import("../../shared/messages.cjs");

type ResumeState = {
  players: Array<unknown>;
  phase?: string;
  winnerId?: string | null;
  currentTurnIndex?: number;
};

type FailedAiTurn = {
  ok: false;
  error?: string;
  errorKey?: string | null;
  errorParams?: Record<string, unknown>;
};

type SuccessfulAiTurn = {
  ok: true;
  [key: string]: unknown;
};

type AiTurnResult = FailedAiTurn | SuccessfulAiTurn;

function currentAiTurnIsStale(state: ResumeState, currentPlayer: ReturnType<typeof getCurrentPlayer>): boolean {
  if (!currentPlayer || !currentPlayer.isAi) {
    return false;
  }

  if (!currentPlayer.id || currentPlayer.surrendered) {
    return true;
  }

  return territoriesOwnedBy(state as Parameters<typeof territoriesOwnedBy>[0], currentPlayer.id).length === 0;
}

export function runAiTurnsIfNeeded(
  targetState: ResumeState,
  options: {
    random?: () => number;
    runAiTurn?: (state: ResumeState, options?: { random?: () => number }) => AiTurnResult;
  } = {}
): AiTurnResult[] {
  const reports: AiTurnResult[] = [];
  const maxTurns = Math.max(4, targetState.players.length * 4);
  const executeAiTurn = options.runAiTurn || ((state: ResumeState, runOptions?: { random?: () => number }) =>
    runAiTurn(state as Parameters<typeof runAiTurn>[0], runOptions)) as NonNullable<typeof options.runAiTurn>;

  for (let step = 0; step < maxTurns; step += 1) {
    const currentPlayer = getCurrentPlayer(targetState as Parameters<typeof getCurrentPlayer>[0]);
    if (!currentPlayer || !currentPlayer.isAi || targetState.phase !== "active" || targetState.winnerId) {
      break;
    }

    if (currentAiTurnIsStale(targetState, currentPlayer)) {
      const previousTurnIndex = targetState.currentTurnIndex;
      const previousPlayerId = currentPlayer.id || null;
      advanceTurn(targetState as Parameters<typeof advanceTurn>[0]);

      const nextPlayer = getCurrentPlayer(targetState as Parameters<typeof getCurrentPlayer>[0]);
      if (
        targetState.phase === "active" &&
        !targetState.winnerId &&
        nextPlayer?.isAi &&
        targetState.currentTurnIndex === previousTurnIndex &&
        nextPlayer.id === previousPlayerId
      ) {
        throw createLocalizedError(
          "Turno AI non riuscito: il turno corrente non puo avanzare.",
          "server.aiTurn.failed"
        );
      }

      continue;
    }

    const result = executeAiTurn(targetState, { random: options.random });
    if (!result.ok) {
      throw createLocalizedError(
        result.error || "Turno AI non riuscito.",
        result.errorKey || "server.aiTurn.failed",
        result.errorParams
      );
    }

    reports.push(result);
  }

  return reports;
}

module.exports = {
  runAiTurnsIfNeeded
};
