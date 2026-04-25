const assert = require("node:assert/strict");
const {
  finishedGameRetentionExpiresAt,
  pruneExpiredFinishedGames
} = require("../../../backend/services/finished-game-retention.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function gameEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "game-1",
    name: "Finished game",
    updatedAt: "2026-04-20T10:00:00.000Z",
    state: {
      phase: "finished",
      gameConfig: {
        turnTimeoutHours: 24
      }
    },
    ...overrides
  };
}

register("finished game retention expires after twice the configured turn timeout", () => {
  const expiresAt = finishedGameRetentionExpiresAt(gameEntry());

  assert.equal(expiresAt?.toISOString(), "2026-04-22T10:00:00.000Z");
});

register("finished game retention ignores active games and games without a turn timeout", () => {
  assert.equal(
    finishedGameRetentionExpiresAt(
      gameEntry({
        state: {
          phase: "active",
          gameConfig: { turnTimeoutHours: 24 }
        }
      })
    ),
    null
  );

  assert.equal(
    finishedGameRetentionExpiresAt(
      gameEntry({
        state: {
          phase: "finished",
          gameConfig: { turnTimeoutHours: null }
        }
      })
    ),
    null
  );
});

register("finished game retention deletes only expired finished games", async () => {
  const deletedGameIds: string[] = [];
  const result = await pruneExpiredFinishedGames({
    now: new Date("2026-04-22T10:00:01.000Z"),
    listGames: () => [
      gameEntry({ id: "expired-finished" }),
      gameEntry({
        id: "fresh-finished",
        updatedAt: "2026-04-21T10:00:00.000Z"
      }),
      gameEntry({
        id: "active-expired",
        state: {
          phase: "active",
          gameConfig: { turnTimeoutHours: 24 }
        }
      }),
      gameEntry({
        id: "finished-without-timeout",
        state: {
          phase: "finished",
          gameConfig: {}
        }
      })
    ],
    deleteGame: (gameId: string) => {
      deletedGameIds.push(gameId);
    }
  });

  assert.deepEqual(deletedGameIds, ["expired-finished"]);
  assert.deepEqual(result, {
    scannedGames: 4,
    eligibleFinishedGames: 3,
    deletedGames: 1,
    skippedWithoutTimeout: 1,
    deletedGameIds: ["expired-finished"]
  });
});
