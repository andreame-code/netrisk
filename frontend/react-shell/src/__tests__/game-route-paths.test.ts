import {
  buildSyncedGameLocation,
  requestedGameIdFromLocation
} from "@frontend-core/game-route-paths.mts";

import { describe, expect, it } from "vitest";

describe("canonical game route helpers", () => {
  it("reads the requested game id from canonical direct routes", () => {
    expect(requestedGameIdFromLocation("/game/game-123", "")).toBe("game-123");
  });

  it("reads the requested game id from the legacy rollback gameplay bridge query string", () => {
    expect(requestedGameIdFromLocation("/legacy/game.html", "?gameId=game-123")).toBe("game-123");
  });

  it("syncs gameplay URLs to the current canonical direct route", () => {
    expect(
      buildSyncedGameLocation("http://127.0.0.1:3100/game.html?gameId=stale", "game-123")
    ).toBe("/game/game-123");
  });

  it("clears the canonical game id back to the clean gameplay root", () => {
    expect(buildSyncedGameLocation("http://127.0.0.1:3100/game/game-123", null)).toBe("/game");
  });

  it("keeps legacy rollback pages inside the /legacy namespace", () => {
    expect(buildSyncedGameLocation("http://127.0.0.1:3100/legacy/lobby.html", "game-123")).toBe(
      "/legacy/game.html?gameId=game-123"
    );
    expect(
      buildSyncedGameLocation("http://127.0.0.1:3100/legacy/game.html?gameId=stale", null)
    ).toBe("/legacy/game.html");
  });
});
