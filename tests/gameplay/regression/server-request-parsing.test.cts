const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { createApp } = require("../../../backend/server.cjs");

type HeaderMap = Record<string, string>;

type MockResponse = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number, nextHeaders?: HeaderMap): void;
  end(chunk?: string): void;
};

function register(name: string, fn: () => unknown | Promise<unknown>) {
  (
    global as typeof globalThis & {
      register?: (name: string, fn: () => unknown | Promise<unknown>) => void;
    }
  ).register?.(name, fn);
}

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
  method: string,
  pathname: string,
  headers: HeaderMap,
  body?: unknown
): Promise<{ statusCode: number; payload: any }> {
  const app = createApp();
  const req = new EventEmitter() as any;
  req.method = method;
  req.url = pathname;
  req.headers = { host: "127.0.0.1", ...headers };
  req.destroy = () => {};

  const res = makeMockResponse();
  const completed = new Promise<void>((resolve) => {
    const originalEnd = res.end.bind(res);
    res.end = (chunk = "") => {
      originalEnd(chunk);
      resolve();
    };
  });

  app.handleRequest(req, res);

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit("data", JSON.stringify(body));
    }
    req.emit("end");
  });

  await completed;
  return {
    statusCode: res.statusCode,
    payload: res.body ? JSON.parse(res.body) : null
  };
}

register("mutation requests reject missing JSON Content-Type", async () => {
  const response = await callApp("POST", "/api/auth/logout", {}, {});

  assert.equal(response.statusCode, 415);
  assert.equal(response.payload.messageKey, "server.unsupportedContentType");
});

register("mutation requests accept JSON Content-Type parameters", async () => {
  const response = await callApp(
    "POST",
    "/api/auth/logout",
    { "content-type": "application/json; charset=utf-8" },
    {}
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, { ok: true });
});

register("mutation requests reject ambiguous non-JSON media types", async () => {
  const response = await callApp(
    "POST",
    "/api/auth/logout",
    { "content-type": "text/plain; application/json" },
    {}
  );

  assert.equal(response.statusCode, 415);
  assert.equal(response.payload.messageKey, "server.unsupportedContentType");
});
