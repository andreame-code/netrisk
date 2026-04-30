const { sendLocalizedError } = require("../../backend/http-response.cjs");
const assert = require("node:assert/strict");

(global as any).register(
  "sendLocalizedError masks internal error details for the client",
  async () => {
    class MockResponse {
      statusCode: number = 0;
      headers: Record<string, string> = {};
      data: string = "";
      headersSent: boolean = false;
      writableEnded: boolean = false;

      writeHead(status: number, headers: Record<string, string>) {
        this.statusCode = status;
        this.headers = headers;
      }

      end(payload: string) {
        this.data = payload;
        this.writableEnded = true;
      }

      setHeader(name: string, value: string) {
        this.headers[name] = value;
      }
    }

    // Test Case 1: 400 Client Error - Details should be visible
    const res400 = new MockResponse();
    const input400 = { message: "Detailed client error", code: "CLIENT_CODE" };
    sendLocalizedError(res400 as any, 400, input400, "Fallback", "fallback.key", {}, null, {
      extra: "info"
    });

    const payload400 = JSON.parse(res400.data);
    assert.strictEqual(res400.statusCode, 400);
    assert.strictEqual(payload400.error, "Detailed client error");
    assert.strictEqual(payload400.code, "CLIENT_CODE");
    assert.strictEqual(payload400.extra, "info");

    // Test Case 2: 500 Internal Error - Details should be MASKED
    const res500 = new MockResponse();
    const input500 = { message: "Sensitive internal detail", code: "INTERNAL_CODE" };
    sendLocalizedError(
      res500 as any,
      500,
      input500,
      "Generic internal error",
      "server.internalError",
      {},
      null,
      { extra: "leaked" }
    );

    const payload500 = JSON.parse(res500.data);
    assert.strictEqual(res500.statusCode, 500);
    assert.strictEqual(payload500.error, "Generic internal error");
    assert.strictEqual(payload500.messageKey, "server.internalError");
    assert.strictEqual(payload500.code, null);
    assert.strictEqual(payload500.extra, undefined);
  }
);
