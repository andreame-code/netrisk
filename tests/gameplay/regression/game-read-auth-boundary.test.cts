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
  headers: HeaderMap = {}
): Promise<{ statusCode: number; headers: HeaderMap; body: string; payload: any }> {
  const req = new EventEmitter() as any;
  req.method = method;
  req.url = pathname;
  req.headers = { host: "127.0.0.1", ...headers };
  req.destroy = () => {};
  const res = makeMockResponse();
  const promise = app.handleApi(req, res, new URL(`http://127.0.0.1${pathname}`));

  process.nextTick(() => {
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
        : null
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
    const password = "secret123";
    const registered = await app.auth.registerPasswordUser(username, password);
    assert.equal(registered.ok, true);
    const login = await app.auth.loginWithPassword(username, password);
    assert.equal(login.ok, true);

    const response = await callApp(app, "GET", `/api/state?gameId=${encodeURIComponent(gameId)}`, {
      cookie: `netrisk_session=${encodeURIComponent(login.sessionToken)}`
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.gameId, gameId);
  });
});
