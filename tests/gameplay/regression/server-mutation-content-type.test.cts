const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createApp } = require("../../../backend/server.cjs");

type HeaderMap = Record<string, string>;

class MockResponse {
  statusCode: number = 0;
  headers: HeaderMap = {};
  body: string = "";
  headersSent: boolean = false;
  writableEnded: boolean = false;
  finished: Promise<void>;
  private finish!: () => void;

  constructor() {
    this.finished = new Promise((resolve) => {
      this.finish = resolve;
    });
  }

  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  writeHead(statusCode: number, headers: HeaderMap = {}) {
    this.statusCode = statusCode;
    Object.assign(this.headers, headers);
    this.headersSent = true;
  }

  end(chunk: string = "") {
    this.body += chunk;
    this.writableEnded = true;
    this.headersSent = true;
    this.finish();
  }
}

async function callApi(method: string, pathname: string, headers: HeaderMap) {
  const app = createApp();
  const req = new EventEmitter() as any;
  req.method = method;
  req.url = pathname;
  req.headers = { host: "127.0.0.1", ...headers };
  req.socket = {};
  req.destroy = () => {};

  const res = new MockResponse();
  app.handleRequest(req, res as any);

  queueMicrotask(() => {
    req.emit("end");
  });

  await res.finished;
  return {
    statusCode: res.statusCode,
    payload: res.body ? JSON.parse(res.body) : null
  };
}

(global as any).register(
  "mutation routes reject missing JSON Content-Type before dispatch",
  async () => {
    const rejected = await callApi("POST", "/api/modules/rescan", {});

    assert.equal(rejected.statusCode, 415);
    assert.equal(rejected.payload.messageKey, "server.unsupportedContentType");
    assert.equal(rejected.payload.code, "UNSUPPORTED_MEDIA_TYPE");

    const authorizedBoundary = await callApi("POST", "/api/modules/rescan", {
      "content-type": "application/json"
    });

    assert.notEqual(authorizedBoundary.statusCode, 415);
  }
);
