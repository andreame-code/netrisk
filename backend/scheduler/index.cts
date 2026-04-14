import { runTurnTimeoutJob } from "./turn-timeout-job.cjs";

export async function runScheduledJobs(
  options: Parameters<typeof runTurnTimeoutJob>[0]
): Promise<{
  ok: true;
  jobs: Array<Awaited<ReturnType<typeof runTurnTimeoutJob>>>;
}> {
  return {
    ok: true,
    jobs: [
      await runTurnTimeoutJob(options)
    ]
  };
}
