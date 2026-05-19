const assert = require("node:assert/strict");
const { handleOpenGameRoute } = require("../../../backend/routes/game-management.cjs");
const { handleAiJoinRoute } = require("../../../backend/routes/game-setup.cjs");

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

register("handleAiJoinRoute maps authorization failures before mutating the lobby", async () => {
  let localizedErrorCall: any[] | null = null;
  let loadCalls = 0;
  let addPlayerCalls = 0;

  await handleAiJoinRoute(
    {},
    {},
    { name: "CPU" },
    new URL("http://localhost/api/ai/join?gameId=g-1"),
    async () => ({
      user: {
        id: "u-1",
        username: "host"
      }
    }),
    async () => {
      loadCalls += 1;
      throw new Error("loadGameContext should not run after failed authorization.");
    },
    () => "g-1",
    async () => {
      throw new Error("not authorized");
    },
    () => {
      throw Object.assign(new Error("forbidden"), { statusCode: 403 });
    },
    () => {
      addPlayerCalls += 1;
      return { ok: false };
    },
    async () => {
      throw new Error("persistGameContext should not run.");
    },
    () => {
      throw new Error("broadcastGame should not run.");
    },
    () => {
      throw new Error("snapshotForState should not run.");
    },
    () => {
      throw new Error("sendJson should not run.");
    },
    (...args: any[]) => {
      localizedErrorCall = args;
    }
  );

  assert.equal(loadCalls, 0);
  assert.equal(addPlayerCalls, 0);
  assert.equal(localizedErrorCall?.[1], 403);
  assert.equal(localizedErrorCall?.[3], "Aggiunta AI non autorizzata.");
  assert.equal(localizedErrorCall?.[4], "server.game.aiJoinUnauthorized");
});

register("handleAiJoinRoute returns 200 when an existing AI rejoins the lobby", async () => {
  const state = { phase: "lobby" };
  let persisted = false;
  let broadcasted = false;
  let sentStatusCode: number | null = null;
  let sentPayload: any = null;

  await handleAiJoinRoute(
    {},
    {},
    { name: "CPU" },
    new URL("http://localhost/api/ai/join?gameId=g-1"),
    async () => ({
      user: {
        id: "u-1",
        username: "host"
      }
    }),
    async () => ({
      state,
      gameId: "g-1",
      version: 7,
      gameName: "AI Lobby"
    }),
    () => "g-1",
    async () => ({
      game: {
        id: "g-1"
      }
    }),
    () => undefined,
    (lobbyState: any, name: string, options: Record<string, unknown>) => {
      assert.equal(lobbyState, state);
      assert.equal(name, "CPU");
      assert.equal(options.isAi, true);
      return {
        ok: true,
        rejoined: true,
        player: {
          id: "ai-1",
          name: "CPU",
          isAi: true
        }
      };
    },
    async (gameContext: any) => {
      assert.equal(gameContext.state, state);
      persisted = true;
      return gameContext;
    },
    (gameContext: any) => {
      assert.equal(gameContext.state, state);
      broadcasted = true;
    },
    (
      _snapshotState: any,
      gameId: string | null,
      version: number | null,
      gameName: string | null
    ) => ({
      gameId,
      version,
      gameName
    }),
    (_res: unknown, statusCode: number, payload: any) => {
      sentStatusCode = statusCode;
      sentPayload = payload;
    },
    () => {
      throw new Error("sendLocalizedError should not run for a rejoined AI.");
    }
  );

  assert.equal(persisted, true);
  assert.equal(broadcasted, true);
  assert.equal(sentStatusCode, 200);
  assert.deepEqual(sentPayload, {
    playerId: "ai-1",
    state: {
      gameId: "g-1",
      version: 7,
      gameName: "AI Lobby"
    },
    player: {
      id: "ai-1",
      name: "CPU",
      isAi: true
    }
  });
});
