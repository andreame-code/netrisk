import { recoverStuckAiTurns } from "../services/ai-turn-recovery.cjs";

export async function runAiTurnRecoveryJob(
  options: Parameters<typeof recoverStuckAiTurns>[0]
): Promise<{
  name: "ai-turn-recovery";
  result: Awaited<ReturnType<typeof recoverStuckAiTurns>>;
}> {
  return {
    name: "ai-turn-recovery",
    result: await recoverStuckAiTurns(options)
  };
}

module.exports = {
  runAiTurnRecoveryJob
};
