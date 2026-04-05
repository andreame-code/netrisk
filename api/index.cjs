const { createApp } = require("../backend/server.cjs");

const app = createApp();

module.exports = (req, res) => {
  return app.handleRequest(req, res);
};
