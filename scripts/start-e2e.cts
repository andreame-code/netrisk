process.env.E2E = "true";
const path = require("path");
const { createApp } = require("../backend/server.cjs");

const port = Number(process.env.E2E_PORT || process.env.PORT || 3100);
const dataFile = path.join(__dirname, "..", "data", "e2e-users.json");
const gamesFile = path.join(__dirname, "..", "data", "e2e-games.json");
const sessionsFile = path.join(__dirname, "..", "data", "e2e-sessions.json");
const dbFile = process.env.E2E_DB_FILE || path.join(__dirname, "..", "data", `e2e-${port}.sqlite`);
const app = createApp({ dataFile, gamesFile, sessionsFile, dbFile });

app.server.listen(port, "127.0.0.1", () => {
  console.log("E2E server attivo su http://127.0.0.1:" + port);
});
