import { createLobbyServer } from "./server/index.js";

export { createLobbyServer };

if (process.argv[1] && process.argv[1].endsWith("multiplayer-server.js")) {
  const port = 8081;
  createLobbyServer({ port });
  // eslint-disable-next-line no-console
  console.log(`Multiplayer server listening on port ${port}`);
}
