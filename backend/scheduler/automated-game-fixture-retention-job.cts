import { pruneExpiredAutomatedGameFixtures } from "../services/automated-game-fixture-retention.cjs";

export async function runAutomatedGameFixtureRetentionJob(
  options: Parameters<typeof pruneExpiredAutomatedGameFixtures>[0]
): Promise<{
  name: "automated-game-fixture-retention";
  result: Awaited<ReturnType<typeof pruneExpiredAutomatedGameFixtures>>;
}> {
  return {
    name: "automated-game-fixture-retention",
    result: await pruneExpiredAutomatedGameFixtures(options)
  };
}
