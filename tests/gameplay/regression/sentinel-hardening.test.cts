import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
const { createApp } = require("../../../backend/server.cjs");

void describe("Sentinel Hardening", () => {
  let app: any;

  beforeEach(() => {
    app = createApp({
      dbFile: ":memory:",
      projectRoot: process.cwd()
    });
  });

  void it("should reject POST requests with missing Content-Type with 415", async () => {
    const req = {
      url: "/api/auth/login",
      method: "POST",
      headers: {
        host: "localhost"
      },
      on: () => {},
      destroy: () => {}
    };

    const res = {
      writeHead: (statusCode: number) => {
        assert.equal(statusCode, 415);
      },
      end: (payload: string) => {
        const data = JSON.parse(payload);
        assert.equal(data.messageKey, "server.unsupportedContentType");
      },
      setHeader: () => {},
      removeHeader: () => {}
    };

    await app.handleRequest(req, res);
  });

  void it("should reject POST requests with incorrect Content-Type with 415", async () => {
    const req = {
      url: "/api/auth/login",
      method: "POST",
      headers: {
        host: "localhost",
        "content-type": "text/plain"
      },
      on: () => {},
      destroy: () => {}
    };

    const res = {
      writeHead: (statusCode: number) => {
        assert.equal(statusCode, 415);
      },
      end: (payload: string) => {
        const data = JSON.parse(payload);
        assert.equal(data.messageKey, "server.unsupportedContentType");
      },
      setHeader: () => {},
      removeHeader: () => {}
    };

    await app.handleRequest(req, res);
  });

  void it("should accept POST requests with application/json Content-Type", async () => {
    // We expect a 400 or other because we're not sending a body, but NOT a 415.
    let capturedStatusCode = 0;
    const req = {
      url: "/api/auth/login",
      method: "POST",
      headers: {
        host: "localhost",
        "content-type": "application/json"
      },
      on: (event: string, cb: any) => {
        if (event === "end") {
          cb();
        }
      },
      destroy: () => {}
    };

    const res = {
      writeHead: (statusCode: number) => {
        capturedStatusCode = statusCode;
      },
      end: () => {},
      setHeader: () => {},
      removeHeader: () => {}
    };

    await app.handleRequest(req, res);
    assert.notEqual(capturedStatusCode, 415);
  });
});
