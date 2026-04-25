import { pruneExpiredFinishedGames } from "../services/finished-game-retention.cjs";

export async function runFinishedGameRetentionJob(
  options: Parameters<typeof pruneExpiredFinishedGames>[0]
): Promise<{
  name: "finished-game-retention";
  result: Awaited<ReturnType<typeof pruneExpiredFinishedGames>>;
}> {
  return {
    name: "finished-game-retention",
    result: await pruneExpiredFinishedGames(options)
  };
}
