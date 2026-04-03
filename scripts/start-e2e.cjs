process.env.E2E = "true";
const path = require("path");
const { createApp } = require("../backend/server.cjs");

const port = Number(process.env.PORT || 3100);
const dataFile = path.join(__dirname, "..", "data", "e2e-users.json");
const gamesFile = path.join(__dirname, "..", "data", "e2e-games.json");
const app = createApp({ dataFile, gamesFile });

app.server.listen(port, () => {
  console.log("E2E server attivo su http://127.0.0.1:" + port);
});
