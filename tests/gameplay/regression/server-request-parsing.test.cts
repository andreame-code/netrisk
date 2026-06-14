const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { parseBody } = require("../../../backend/server.cjs");

function createRequest(options: { method: string; contentType: string; body: string }) {
  const req = new EventEmitter() as any;
  req.method = options.method;
  req.headers = {
    "content-type": options.contentType
  };
  req.destroy = () => {};

  queueMicrotask(() => {
    req.emit("data", options.body);
    req.emit("end");
  });

  return req;
}

(global as any).register("parseBody accepts JSON media types case-insensitively", async () => {
  const body = await parseBody(
    createRequest({
      method: "POST",
      contentType: "Application/JSON; charset=utf-8",
      body: '{"ok":true}'
    })
  );

  assert.deepStrictEqual(body, { ok: true });
});
