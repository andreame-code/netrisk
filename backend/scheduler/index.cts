import { runAiTurnRecoveryJob } from "./ai-turn-recovery-job.cjs";
import { runTurnTimeoutJob } from "./turn-timeout-job.cjs";

export async function runScheduledJobs(
  options: Parameters<typeof runTurnTimeoutJob>[0] & Parameters<typeof runAiTurnRecoveryJob>[0]
): Promise<{
  ok: true;
  jobs: Array<
    | Awaited<ReturnType<typeof runTurnTimeoutJob>>
    | Awaited<ReturnType<typeof runAiTurnRecoveryJob>>
  >;
}> {
  return {
    ok: true,
    jobs: [
      await runTurnTimeoutJob(options),
      await runAiTurnRecoveryJob(options)
    ]
  };
}
