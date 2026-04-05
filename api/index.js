const { createApp } = require("../backend/server.cjs");

const app = createApp();

module.exports = (req, res) => app.handleRequest(req, res);
