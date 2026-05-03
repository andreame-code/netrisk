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
    `netrisk-removed-runtime-assets-${process.pid}-${Date.now()}`
  );
  const app = createApp({
    projectRoot: process.cwd(),
    dbFile: path.join(tempRoot, "data", "runtime-assets.sqlite"),
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

register(
  "GET /legacy/generated/shared-runtime-validation.mjs is not served after static UI removal",
  async () => {
    await withApp(async (app: any) => {
      const response = await callRequest(app, "/legacy/generated/shared-runtime-validation.mjs");

      assert.equal(response.statusCode, 404);
    });
  }
);

register("GET /modules serves declared public module assets", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(
      app,
      "/modules/demo.command-center/assets/command-center.css"
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["Content-Type"], "text/css; charset=utf-8");
  });
});

register("GET /modules does not serve module manifests or server entrypoints", async () => {
  await withApp(async (app: any) => {
    const cases = [
      "/modules/demo.command-center/module.json",
      "/modules/demo.command-center/server-module.cts"
    ];

    for (const requestPath of cases) {
      const response = await callRequest(app, requestPath);

      assert.equal(response.statusCode, 404, requestPath);
    }
  });
});
