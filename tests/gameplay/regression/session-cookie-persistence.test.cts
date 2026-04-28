const assert = require("node:assert/strict");
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

async function callApp(
  app: any,
  method: string,
  pathname: string,
  body?: any,
  headers: HeaderMap = {}
): Promise<{ statusCode: number; headers: HeaderMap; payload: any }> {
  const req = new (require("events").EventEmitter)();
  req.method = method;
  req.headers = { "content-type": "application/json", ...headers };
  req.destroy = () => {};
  const res = makeMockResponse();
  const promise = app.handleApi(req, res, new URL(`http://127.0.0.1${pathname}`));

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit("data", JSON.stringify(body));
    }
    req.emit("end");
  });

  await promise;
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    payload: res.body ? JSON.parse(res.body) : null
  };
}

async function withApp(run: (app: any) => Promise<void>): Promise<void> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-auth-cookie-"));
  const dataDir = path.join(tempRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const app = createApp({
    projectRoot: process.cwd(),
    dbFile: path.join(dataDir, "auth.sqlite"),
    dataFile: path.join(dataDir, "users.json"),
    gamesFile: path.join(dataDir, "games.json"),
    sessionsFile: path.join(dataDir, "sessions.json")
  });

  try {
    await run(app);
  } finally {
    app.datastore.close();
  }
}

register(
  "login response persists the session cookie for the server-side session lifetime",
  async () => {
    await withApp(async (app: any) => {
      const username = `cookie_commander_${Date.now()}`;
      const password = "secret123";

      const registerResponse = await callApp(app, "POST", "/api/auth/register", {
        username,
        password,
        email: `${username}@example.com`
      });

      assert.equal(registerResponse.statusCode, 201);

      const loginResponse = await callApp(app, "POST", "/api/auth/login", {
        username,
        password
      });

      assert.equal(loginResponse.statusCode, 200);
      assert.match(loginResponse.headers["Set-Cookie"] || "", /(?:^|;\s*)Max-Age=2592000(?:;|$)/);
    });
  }
);
