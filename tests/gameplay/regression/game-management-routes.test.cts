const assert = require("node:assert/strict");
const { handleOpenGameRoute } = require("../../../backend/routes/game-management.cjs");
const { handleAiJoinRoute } = require("../../../backend/routes/game-setup.cjs");
const { handleCardsTradeRoute } = require("../../../backend/routes/game-cards.cjs");

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

register("handleCardsTradeRoute keeps throttles scoped to game id", async () => {
  const throttleState: Record<string, number> = {};
  const authAttemptThrottle = {
    check(key: any) {
      const usernameKey = String(key.username || "");
      return {
        allowed: (throttleState[usernameKey] || 0) < 1,
        retryAfterSeconds: 30
      };
    },
    recordAttempt(key: any) {
      const usernameKey = String(key.username || "");
      throttleState[usernameKey] = (throttleState[usernameKey] || 0) + 1;
    },
    recordFailure() {
      return { allowed: false, retryAfterSeconds: 30 };
    },
    recordSuccess() {}
  };

  const tradeCalls: Array<{ gameId: string | null; cardIds: string[] }> = [];
  const snapshotForUserCalls: string[] = [];
  const payloadCalls: Array<{ statusCode: number; payload: Record<string, unknown> }> = [];
  const localizedErrors: any[] = [];
  const loadCalls: string[] = [];

  const runTrade = async (gameId: string) => {
    return handleCardsTradeRoute(
      {
        headers: {},
        socket: { remoteAddress: "198.51.100.1" }
      },
      {},
      {
        playerId: "p-1",
        cardIds: ["c1", "c2", "c3"]
      },
      new URL(`http://localhost/api/cards/trade?gameId=${encodeURIComponent(gameId)}`),
      async () => ({
        user: {
          id: "u-1",
          username: "hero"
        }
      }),
      async (targetGameId: string | null) => {
        loadCalls.push(String(targetGameId));
        return {
          state: { phase: "lobby" },
          gameId: targetGameId,
          version: 1,
          gameName: `Game ${targetGameId}`
        };
      },
      (body: Record<string, any>) => body.gameId || "",
      (state: any, playerId: string) => ({ id: playerId }),
      (player: any) => player?.id === "p-1",
      () => {
        tradeCalls.push({ gameId, cardIds: ["c1", "c2", "c3"] });
        return {
          ok: true,
          bonus: { armies: 5 },
          validation: {}
        };
      },
      async (gameContext: any) => gameContext,
      () => {
        return;
      },
      (state: any, gameId: string | null, version: number | null, gameName: string | null) => {
        const snapshot = { state, gameId, version, gameName };
        snapshotForUserCalls.push(`snapshot:${gameId}:${version}`);
        return snapshot;
      },
      (_res: unknown, statusCode: number, payload: Record<string, unknown>) => {
        payloadCalls.push({ statusCode, payload });
      },
      (...args: any[]) => {
        localizedErrors.push(args);
      },
      authAttemptThrottle
    );
  };

  await runTrade("game-a");
  await runTrade("game-b");
  await runTrade("game-a");

  assert.equal(tradeCalls.length, 2);
  assert.equal(loadCalls.length, 2);
  assert.equal(payloadCalls.length, 2);
  assert.equal(payloadCalls[0]?.statusCode, 200);
  assert.equal(payloadCalls[1]?.statusCode, 200);
  assert.equal(localizedErrors.length, 1);
  assert.equal(localizedErrors[0]?.[1], 429);
  assert.deepEqual(Object.keys(throttleState).sort(), ["u-1:game-a", "u-1:game-b"].sort());
  assert.equal(snapshotForUserCalls.length, 2);
  assert.equal(snapshotForUserCalls[0], "snapshot:game-a:1");
});
