import type { IncomingMessage, ServerResponse } from "node:http";

const { createApp } = require("../.tsbuild/backend/server.cjs");

const app = createApp();

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  return app.handleRequest(req, res);
}

export default handleRequest;
