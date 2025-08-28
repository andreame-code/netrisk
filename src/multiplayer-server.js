import { createLobbyServer } from "./server/index.ts";

export { createLobbyServer };

if (typeof require !== "undefined" && require.main === module) {
  const port = 8081;
  createLobbyServer({ port });
  // eslint-disable-next-line no-console
  console.log(`Multiplayer server listening on port ${port}`);
}
