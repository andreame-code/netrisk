const assert = require("node:assert/strict");
const { handleOpenGameRoute } = require("../../../backend/routes/game-management.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("handleOpenGameRoute returns the per-user snapshot for the opener", async () => {
  let sentPayload: Record<string, unknown> | null = null;

  await handleOpenGameRoute(
    { headers: {} },
    {},
    {
      gameId: "g-1"
    },
    async () => ({
      user: {
        id: "u-1",
        username: "Commander"
      }
    }),
    () => ({ actor: { id: "u-1" } }),
    async () => ({
      game: {
        id: "g-1",
        name: "Open Route"
      },
      state: {
        phase: "active"
      }
    }),
    async () => ({
      game: {
        id: "g-1",
        name: "Open Route",
        version: 5
      },
      state: {
        phase: "active"
      }
    }),
    async () => [],
    async () => undefined,
    () => ({
      id: "p-1"
    }),
    (
      state: Record<string, unknown>,
      gameId: string | null,
      version: number | null,
      gameName: string | null,
      user: unknown
    ) => ({
      state,
      gameId,
      version,
      gameName,
      playerId: "p-1",
      assignedVictoryObjective: {
        moduleId: "victory.module",
        moduleName: "Victory Module",
        id: "mission-a",
        title: "Mission A",
        description: "Complete mission A.",
        type: "control-territory-count"
      },
      user
    }),
    (_res: unknown, _statusCode: number, payload: Record<string, unknown>) => {
      sentPayload = payload;
    },
    () => {
      throw new Error("sendLocalizedError should not run for a successful open route.");
    }
  );

  assert.deepEqual(sentPayload, {
    ok: true,
    game: {
      id: "g-1",
      name: "Open Route",
      version: 5
    },
    games: [],
    activeGameId: "g-1",
    state: {
      state: {
        phase: "active"
      },
      gameId: "g-1",
      version: 5,
      gameName: "Open Route",
      playerId: "p-1",
      assignedVictoryObjective: {
        moduleId: "victory.module",
        moduleName: "Victory Module",
        id: "mission-a",
        title: "Mission A",
        description: "Complete mission A.",
        type: "control-territory-count"
      },
      user: {
        id: "u-1",
        username: "Commander"
      }
    },
    playerId: "p-1"
  });
});
