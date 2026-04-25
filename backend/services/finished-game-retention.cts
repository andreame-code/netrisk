import { resolveTurnTimeoutHours } from "../engine/turn-timeout.cjs";

type GameEntry = {
  id: string;
  name?: string;
  state: Record<string, unknown>;
  updatedAt?: string | null;
};

export interface FinishedGameRetentionResult {
  scannedGames: number;
  eligibleFinishedGames: number;
  deletedGames: number;
  skippedWithoutTimeout: number;
  deletedGameIds: string[];
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function finishedGameRetentionExpiresAt(entry: GameEntry): Date | null {
  if (entry?.state?.phase !== "finished") {
    return null;
  }

  const timeoutHours = resolveTurnTimeoutHours(
    entry.state as unknown as Parameters<typeof resolveTurnTimeoutHours>[0]
  );
  if (timeoutHours == null) {
    return null;
  }

  const finishedAt = parseDate(entry.updatedAt);
  if (!finishedAt) {
    return null;
  }

  return new Date(finishedAt.getTime() + timeoutHours * 2 * 60 * 60 * 1000);
}

export async function pruneExpiredFinishedGames(options: {
  listGames: () => Promise<GameEntry[]> | GameEntry[];
  deleteGame: (gameId: string) => Promise<unknown> | unknown;
  afterDelete?: (payload: { gameId: string; gameName: string | null }) => Promise<void> | void;
  now?: Date;
}): Promise<FinishedGameRetentionResult> {
  const entries = await options.listGames();
  const now = options.now || new Date();
  const result: FinishedGameRetentionResult = {
    scannedGames: entries.length,
    eligibleFinishedGames: 0,
    deletedGames: 0,
    skippedWithoutTimeout: 0,
    deletedGameIds: []
  };

  for (const entry of entries) {
    if (entry?.state?.phase !== "finished") {
      continue;
    }

    result.eligibleFinishedGames += 1;
    const expiresAt = finishedGameRetentionExpiresAt(entry);
    if (!expiresAt) {
      result.skippedWithoutTimeout += 1;
      continue;
    }

    if (expiresAt.getTime() >= now.getTime()) {
      continue;
    }

    await options.deleteGame(entry.id);
    if (options.afterDelete) {
      await options.afterDelete({
        gameId: entry.id,
        gameName: typeof entry.name === "string" ? entry.name : null
      });
    }
    result.deletedGames += 1;
    result.deletedGameIds.push(entry.id);
  }

  return result;
}
