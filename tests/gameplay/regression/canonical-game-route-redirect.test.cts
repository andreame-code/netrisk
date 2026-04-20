const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("../../../backend/server.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type HeaderMap = Record<string, string>;

type MockResponse = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number, nextHeaders?: HeaderMap): void;
  end(chunk?: string): void;
};

function makeMockResponse(): MockResponse {
  const headers: HeaderMap = {};
  return {
    statusCode: 200,
    headers,
    body: "",
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    writeHead(statusCode: number, nextHeaders: HeaderMap = {}) {
      this.statusCode = statusCode;
      Object.assign(headers, nextHeaders);
    },
    end(chunk = "") {
      this.body += chunk || "";
    }
  };
}

async function callRequest(app: any, pathname: string): Promise<MockResponse> {
  const req = new (require("events").EventEmitter)();
  req.method = "GET";
  req.url = pathname;
  req.headers = { host: "127.0.0.1" };
  req.destroy = () => {};

  const res = makeMockResponse();

  await new Promise<void>((resolve) => {
    const originalEnd = res.end.bind(res);
    res.end = (chunk = "") => {
      originalEnd(chunk);
      resolve();
    };
    app.handleRequest(req, res);
  });

  return res;
}

async function withApp(run: (app: any) => Promise<void>): Promise<void> {
  const tempRoot = path.join(
    os.tmpdir(),
    `netrisk-canonical-game-route-${process.pid}-${Date.now()}`
  );
  const app = createApp({
    projectRoot: process.cwd(),
    dbFile: path.join(tempRoot, "data", "routes.sqlite"),
    dataFile: path.join(tempRoot, "data", "users.json"),
    gamesFile: path.join(tempRoot, "data", "games.json"),
    sessionsFile: path.join(tempRoot, "data", "sessions.json")
  });

  try {
    await run(app);
  } finally {
    app.datastore.close();
  }
}

register("GET /game.html redirects to the canonical React gameplay entry", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(app, "/game.html");

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.Location, "/game");
  });
});

register("GET /game.html with gameId preserves the canonical React deep link", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(app, "/game.html?gameId=g-123");

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.Location, "/game/g-123");
  });
});
