const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp, parseBody } = require("../../../backend/server.cjs");

class MockResponse {
  statusCode: number = 0;
  headers: Record<string, string | string[]> = {};
  data: string = "";
  headersSent: boolean = false;
  writableEnded: boolean = false;
  finished: Promise<void>;
  private finish!: () => void;

  constructor() {
    this.finished = new Promise((resolve) => {
      this.finish = resolve;
    });
  }

  writeHead(status: number, headers: Record<string, string | string[]>) {
    this.statusCode = status;
    this.headers = {
      ...this.headers,
      ...headers
    };
    this.headersSent = true;
  }

  end(payload: string = "") {
    this.data += payload;
    this.writableEnded = true;
    this.headersSent = true;
    this.finish();
  }

  setHeader(name: string, value: string | string[]) {
    this.headers[name] = value;
  }
}

function createRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  const req = new EventEmitter() as any;
  req.method = options.method || "GET";
  req.url = options.url || "/";
  req.headers = options.headers || {};
  req.socket = {};
  req.destroy = function destroy() {
    req.destroyed = true;
  };

  queueMicrotask(() => {
    if (options.body) {
      req.emit("data", options.body);
    }
    req.emit("end");
  });

  return req;
}

(global as any).register("parseBody accepts only exact application/json media type", async () => {
  const accepted = await parseBody(
    createRequest({
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: '{"ok":true}'
    })
  );

  assert.deepStrictEqual(accepted, { ok: true });

  for (const contentType of [
    "application/json-patch+json",
    "application/jsonfoo",
    "text/plain; application/json"
  ]) {
    await assert.rejects(
      () =>
        parseBody(
          createRequest({
            method: "POST",
            headers: {
              "content-type": contentType
            },
            body: '{"ok":true}'
          })
        ),
      (error: any) => {
        assert.strictEqual(error.statusCode, 415);
        assert.strictEqual(error.messageKey, "server.unsupportedContentType");
        assert.strictEqual(error.code, "UNSUPPORTED_CONTENT_TYPE");
        return true;
      }
    );
  }
});

(global as any).register("global request handler masks internal server errors", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-server-request-"));

  try {
    const app = createApp({
      dbFile: path.join(tempDir, "netrisk.sqlite"),
      dataFile: path.join(tempDir, "data.json"),
      gamesFile: path.join(tempDir, "games.json"),
      sessionsFile: path.join(tempDir, "sessions.json"),
      projectRoot: process.cwd()
    });
    app.datastore.healthSummary = async () => {
      throw new Error("SECRET_INTERNAL_DETAIL");
    };

    const req = createRequest({
      method: "GET",
      url: "/api/health",
      headers: {
        host: "127.0.0.1"
      }
    });
    const res = new MockResponse();

    app.handleRequest(req, res as any);
    await res.finished;

    assert.strictEqual(res.statusCode, 500);
    const payload = JSON.parse(res.data);
    assert.strictEqual(payload.error, "Errore interno.");
    assert.strictEqual(payload.messageKey, "server.internalError");
    assert.strictEqual(payload.code, null);
    assert.ok(!res.data.includes("SECRET_INTERNAL_DETAIL"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
