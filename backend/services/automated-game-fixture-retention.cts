const AUTOMATED_GAME_FIXTURE_PREFIX = /^(?:route_game_|ci preview(?:\s|$)|preview-probe-)/i;

export const AUTOMATED_GAME_FIXTURE_RETENTION_MS = 24 * 60 * 60 * 1000;

type GameFixtureEntry = {
  id?: unknown;
  name?: unknown;
  updatedAt?: unknown;
};

export interface AutomatedGameFixtureRetentionResult {
  scannedGames: number;
  matchedFixtures: number;
  eligibleFixtures: number;
  deletedGames: number;
  skippedInvalidUpdatedAt: number;
  deletedGameIds: string[];
}

function matchesAutomatedFixturePrefix(value: unknown): boolean {
  return typeof value === "string" && AUTOMATED_GAME_FIXTURE_PREFIX.test(value.trim());
}

export function isAutomatedGameFixture(entry: GameFixtureEntry): boolean {
  return matchesAutomatedFixturePrefix(entry?.id) || matchesAutomatedFixturePrefix(entry?.name);
}

export function filterAutomatedGameFixtures<T extends GameFixtureEntry>(
  entries: readonly T[]
): T[] {
  return entries.filter((entry) => !isAutomatedGameFixture(entry));
}

function parseUpdatedAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function pruneExpiredAutomatedGameFixtures(options: {
  listGames: () => Promise<GameFixtureEntry[]> | GameFixtureEntry[];
  deleteGame: (gameId: string) => Promise<unknown> | unknown;
  afterDelete?: (payload: { gameId: string; gameName: string | null }) => Promise<void> | void;
  now?: Date;
  retentionMs?: number;
}): Promise<AutomatedGameFixtureRetentionResult> {
  const entries = await options.listGames();
  const now = options.now || new Date();
  const retentionMs = options.retentionMs ?? AUTOMATED_GAME_FIXTURE_RETENTION_MS;
  const expiresBefore = now.getTime() - retentionMs;
  const result: AutomatedGameFixtureRetentionResult = {
    scannedGames: entries.length,
    matchedFixtures: 0,
    eligibleFixtures: 0,
    deletedGames: 0,
    skippedInvalidUpdatedAt: 0,
    deletedGameIds: []
  };

  for (const entry of entries) {
    if (!isAutomatedGameFixture(entry)) {
      continue;
    }

    result.matchedFixtures += 1;
    const updatedAt = parseUpdatedAt(entry.updatedAt);
    if (!updatedAt) {
      result.skippedInvalidUpdatedAt += 1;
      continue;
    }

    if (updatedAt.getTime() > expiresBefore) {
      continue;
    }

    const gameId = typeof entry.id === "string" ? entry.id : "";
    if (!gameId) {
      continue;
    }

    result.eligibleFixtures += 1;
    await options.deleteGame(gameId);
    if (options.afterDelete) {
      await options.afterDelete({
        gameId,
        gameName: typeof entry.name === "string" ? entry.name : null
      });
    }
    result.deletedGames += 1;
    result.deletedGameIds.push(gameId);
  }

  return result;
}
