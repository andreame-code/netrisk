const assert = require("node:assert/strict");
const {
  handleEventsRoute,
  handleStateRoute
} = require("../../../backend/routes/game-read.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("handleStateRoute resumes AI turns before returning the snapshot", async () => {
  const calls: string[] = [];
  let sentPayload: Record<string, unknown> | null = null;
  const stateObject: Record<string, unknown> = { phase: "active" };
  const gameContext = {
    gameId: "g-1",
    version: 7,
    gameName: "State Route",
    state: stateObject
  };

  await handleStateRoute(
    { headers: {} },
    {},
    new URL("https://netrisk.test/api/state?gameId=g-1"),
    async () => ({ ok: true, user: { id: "u-1" } }),
    (_body: Record<string, unknown>, url: URL | null) => url?.searchParams.get("gameId") || null,
    async () => {
      calls.push("load");
      return gameContext;
    },
    async (context: typeof gameContext) => {
      calls.push("resume");
      context.version = 8;
      context.state = { ...context.state, resumed: true };
      return [{ ok: true }];
    },
    async () => {
      calls.push("session");
      return { id: "fallback-user" };
    },
    () => {
      calls.push("extract");
      return "session-token";
    },
    (state: Record<string, unknown>, gameId: string | null, version: number | null, gameName: string | null, user: unknown) => ({
      state,
      gameId,
      version,
      gameName,
      user
    }),
    (_res: unknown, _statusCode: number, payload: Record<string, unknown>) => {
      sentPayload = payload;
    }
  );

  assert.deepEqual(calls, ["load", "resume"]);
  assert.deepEqual(sentPayload, {
    state: { phase: "active", resumed: true },
    gameId: "g-1",
    version: 8,
    gameName: "State Route",
    user: { id: "u-1" }
  });
});

register("handleStateRoute falls back to the session user when authorizeGameRead has no linked user", async () => {
  const calls: string[] = [];
  let sentPayload: Record<string, unknown> | null = null;

  await handleStateRoute(
    { headers: {} },
    {},
    new URL("https://netrisk.test/api/state?gameId=g-2"),
    async () => ({ ok: true, user: null }),
    (_body: Record<string, unknown>, url: URL | null) => url?.searchParams.get("gameId") || null,
    async () => ({
      gameId: "g-2",
      version: 3,
      gameName: "Fallback User",
      state: { phase: "active" }
    }),
    async () => {
      calls.push("resume");
      return [];
    },
    async (sessionToken: string | null) => {
      calls.push("session");
      assert.equal(sessionToken, "session-token");
      return { id: "fallback-user" };
    },
    () => "session-token",
    (state: Record<string, unknown>, gameId: string | null, version: number | null, gameName: string | null, user: unknown) => ({
      state,
      gameId,
      version,
      gameName,
      user
    }),
    (_res: unknown, _statusCode: number, payload: Record<string, unknown>) => {
      sentPayload = payload;
    }
  );

  assert.deepEqual(calls, ["resume", "session"]);
  assert.ok(sentPayload);
  const payload = sentPayload as unknown as { user: { id: string } };
  assert.equal(payload.user.id, "fallback-user");
});

register("handleStateRoute returns early when authorizeGameRead blocks access", async () => {
  let sendJsonCalled = false;

  await handleStateRoute(
    { headers: {} },
    {},
    new URL("https://netrisk.test/api/state?gameId=g-3"),
    async () => null,
    () => "g-3",
    async () => {
      throw new Error("loadGameContext should not run when access is denied.");
    },
    async () => {
      throw new Error("resumeAiTurnsForRead should not run when access is denied.");
    },
    async () => {
      throw new Error("getUserFromSession should not run when access is denied.");
    },
    () => {
      throw new Error("extractSessionToken should not run when access is denied.");
    },
    () => {
      throw new Error("snapshotForUser should not run when access is denied.");
    },
    () => {
      sendJsonCalled = true;
    }
  );

  assert.equal(sendJsonCalled, false);
});

register("handleEventsRoute keeps SSE reads non-mutating and streams the current snapshot", async () => {
  const calls: string[] = [];
  const writes: string[] = [];
  const closeHandlers: Array<() => void> = [];
  const stateObject: Record<string, unknown> = { phase: "active", currentTurnIndex: 2 };
  const gameContext = {
    gameId: "g-1",
    version: 9,
    gameName: "Events Route",
    state: stateObject
  };
  const clientsByGameId = new Map<string, Set<{ res: unknown; user: unknown }>>();

  const req = {
    on(eventName: string, handler: () => void) {
      if (eventName === "close") {
        closeHandlers.push(handler);
      }
    }
  };
  const res = {
    writeHead(_statusCode: number, _headers: Record<string, string>) {
    },
    write(chunk: string) {
      writes.push(chunk);
    }
  };

  await handleEventsRoute(
    req,
    res,
    new URL("https://netrisk.test/api/events?gameId=g-1"),
    async () => ({ ok: true, user: { id: "u-2" } }),
    (_body: Record<string, unknown>, url: URL | null) => url?.searchParams.get("gameId") || null,
    async () => {
      calls.push("load");
      return gameContext;
    },
    async () => {
      calls.push("resume");
      throw new Error("resumeAiTurnsForRead should not run for SSE reads.");
    },
    (state: Record<string, unknown>, gameId: string | null, version: number | null, gameName: string | null, user: unknown) => ({
      state,
      gameId,
      version,
      gameName,
      user
    }),
    clientsByGameId
  );

  assert.deepEqual(calls, ["load"]);
  assert.equal(writes.length, 1);
  assert.equal(
    writes[0],
    "data: " + JSON.stringify({
      state: stateObject,
      gameId: "g-1",
      version: 9,
      gameName: "Events Route",
      user: { id: "u-2" }
    }) + "\n\n"
  );
  assert.equal(clientsByGameId.get("g-1")?.size, 1);
  assert.equal(closeHandlers.length, 1);

  closeHandlers[0]();
  assert.equal(clientsByGameId.has("g-1"), false);
});

register("handleEventsRoute returns early when authorizeGameRead blocks access", async () => {
  const clientsByGameId = new Map<string, Set<{ res: unknown; user: unknown }>>();
  let writeHeadCalled = false;

  await handleEventsRoute(
    {
      on() {
      }
    },
    {
      writeHead() {
        writeHeadCalled = true;
      },
      write() {
        throw new Error("write should not run when access is denied.");
      }
    },
    new URL("https://netrisk.test/api/events?gameId=g-4"),
    async () => null,
    () => "g-4",
    async () => {
      throw new Error("loadGameContext should not run when access is denied.");
    },
    async () => {
      throw new Error("resumeAiTurnsForRead should not run when access is denied.");
    },
    () => {
      throw new Error("snapshotForUser should not run when access is denied.");
    },
    clientsByGameId
  );

  assert.equal(writeHeadCalled, false);
  assert.equal(clientsByGameId.size, 0);
});
