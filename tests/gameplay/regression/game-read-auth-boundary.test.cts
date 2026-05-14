const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("../../../backend/server.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type HeaderMap = Record<string, string>;

type MockResponse = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
  headersSent: boolean;
  writableEnded: boolean;
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number, nextHeaders?: HeaderMap): void;
  write(chunk: string): void;
  end(chunk?: string): void;
};

function makeMockResponse(): MockResponse {
  const headers: HeaderMap = {};
  return {
    statusCode: 200,
    headers,
    body: "",
    headersSent: false,
    writableEnded: false,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    writeHead(statusCode: number, nextHeaders: HeaderMap = {}) {
      this.statusCode = statusCode;
      this.headersSent = true;
      Object.assign(headers, nextHeaders);
    },
    write(chunk: string) {
      this.body += chunk || "";
    },
    end(chunk = "") {
      this.body += chunk || "";
      this.writableEnded = true;
    }
  };
}

async function callApp(
  app: any,
  method: string,
  pathname: string,
  headers: HeaderMap = {},
  body?: Record<string, unknown>
): Promise<{
  statusCode: number;
  headers: HeaderMap;
  body: string;
  payload: any;
  response: MockResponse;
}> {
  const req = new EventEmitter() as any;
  req.method = method;
  req.url = pathname;
  const serializedBody = body ? JSON.stringify(body) : "";
  req.headers = {
    host: "127.0.0.1",
    ...(serializedBody ? { "content-type": "application/json" } : {}),
    ...headers
  };
  req.destroy = () => {};
  const res = makeMockResponse();
  const promise = app.handleApi(req, res, new URL(`http://127.0.0.1${pathname}`));

  process.nextTick(() => {
    if (serializedBody) {
      req.emit("data", serializedBody);
    }
    req.emit("end");
  });

  await promise;
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body,
    payload:
      res.body && res.headers["Content-Type"]?.includes("application/json")
        ? JSON.parse(res.body)
        : null,
    response: res
  };
}

function cleanupSqliteFiles(baseFile: string): void {
  [baseFile, `${baseFile}-shm`, `${baseFile}-wal`].forEach((target) => {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  });
}

async function withLegacyCreatorlessApp(
  run: (context: { app: any; gameId: string }) => Promise<void>
): Promise<void> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-read-auth-"));
  const dataDir = path.join(tempRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const tempDbFile = path.join(dataDir, "read-auth.sqlite");
  const app = createApp({
    projectRoot: process.cwd(),
    dbFile: tempDbFile,
    dataFile: path.join(dataDir, "users.json"),
    gamesFile: path.join(dataDir, "games.json"),
    sessionsFile: path.join(dataDir, "sessions.json")
  });

  try {
    const gameId = app.datastore.getActiveGameId();
    assert.equal(typeof gameId, "string");
    const gameRecord = app.datastore.findGameById(gameId);
    assert.equal(gameRecord.creatorUserId, null);

    await run({ app, gameId });
  } finally {
    app.datastore.close();
    cleanupSqliteFiles(tempDbFile);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function createPasswordSession(app: any, username: string): Promise<string> {
  const registered = await app.auth.registerPasswordUser(username, "secret123");
  assert.equal(registered.ok, true);
  const login = await app.auth.loginWithPassword(username, "secret123");
  assert.equal(login.ok, true);
  return login.sessionToken;
}

function sessionCookie(sessionToken: string): string {
  return `netrisk_session=${encodeURIComponent(sessionToken)}`;
}

register("unauthenticated creatorless legacy state reads require authentication", async () => {
  await withLegacyCreatorlessApp(async ({ app, gameId }) => {
    const response = await callApp(app, "GET", `/api/state?gameId=${encodeURIComponent(gameId)}`);

    assert.equal(response.statusCode, 401);
    assert.equal(response.payload.code, "AUTH_REQUIRED");
  });
});

register("unauthenticated creatorless legacy event streams require authentication", async () => {
  await withLegacyCreatorlessApp(async ({ app, gameId }) => {
    const response = await callApp(app, "GET", `/api/events?gameId=${encodeURIComponent(gameId)}`);

    assert.equal(response.statusCode, 401);
    assert.equal(response.payload.code, "AUTH_REQUIRED");
    assert.notEqual(response.headers["Content-Type"], "text/event-stream");
  });
});

register("authenticated users can still read creatorless legacy game state", async () => {
  await withLegacyCreatorlessApp(async ({ app, gameId }) => {
    const username = `legacy_reader_${Date.now()}`;
    const sessionToken = await createPasswordSession(app, username);

    const response = await callApp(app, "GET", `/api/state?gameId=${encodeURIComponent(gameId)}`, {
      cookie: sessionCookie(sessionToken)
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.gameId, gameId);
  });
});

register(
  "lobby SSE listeners without membership are dropped before active broadcasts",
  async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-sse-auth-"));
    const dataDir = path.join(tempRoot, "data");
    fs.mkdirSync(dataDir, { recursive: true });

    const tempDbFile = path.join(dataDir, "sse-auth.sqlite");
    const app = createApp({
      projectRoot: process.cwd(),
      dbFile: tempDbFile,
      dataFile: path.join(dataDir, "users.json"),
      gamesFile: path.join(dataDir, "games.json"),
      sessionsFile: path.join(dataDir, "sessions.json")
    });

    try {
      const suffix = Date.now();
      const creatorSession = await createPasswordSession(app, `sse_creator_${suffix}`);
      const watcherSession = await createPasswordSession(app, `sse_watcher_${suffix}`);
      const creatorHeaders = { cookie: sessionCookie(creatorSession) };

      const created = await callApp(app, "POST", "/api/games", creatorHeaders, {
        name: "SSE Auth Boundary"
      });
      assert.equal(created.statusCode, 201);
      const gameId = created.payload.activeGameId;
      const creatorPlayerId = created.payload.playerId;
      assert.equal(typeof gameId, "string");
      assert.equal(typeof creatorPlayerId, "string");

      const eventStream = await callApp(
        app,
        "GET",
        `/api/events?gameId=${encodeURIComponent(gameId)}`,
        {
          cookie: sessionCookie(watcherSession)
        }
      );
      assert.equal(eventStream.statusCode, 200);
      assert.equal(eventStream.headers["Content-Type"], "text/event-stream");
      const initialEventLength = eventStream.response.body.length;

      const aiJoin = await callApp(app, "POST", "/api/ai/join", creatorHeaders, {
        gameId,
        name: "AI Sentinel"
      });
      assert.equal(aiJoin.statusCode, 201);
      assert.ok(eventStream.response.body.length > initialEventLength);
      const lobbyEventLength = eventStream.response.body.length;

      const started = await callApp(app, "POST", "/api/start", creatorHeaders, {
        gameId,
        playerId: creatorPlayerId
      });
      assert.equal(started.statusCode, 200);
      assert.equal(started.payload.state.phase, "active");
      assert.equal(eventStream.response.body.length, lobbyEventLength);
    } finally {
      app.datastore.close();
      cleanupSqliteFiles(tempDbFile);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);
