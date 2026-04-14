import { enforceTurnTimeouts } from "../services/turn-timeout-enforcement.cjs";

export async function runTurnTimeoutJob(
  options: Parameters<typeof enforceTurnTimeouts>[0]
): Promise<{
  name: "turn-timeout-enforcement";
  result: Awaited<ReturnType<typeof enforceTurnTimeouts>>;
}> {
  return {
    name: "turn-timeout-enforcement",
    result: await enforceTurnTimeouts(options)
  };
}
