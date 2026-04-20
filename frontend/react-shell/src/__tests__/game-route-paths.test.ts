import {
  buildSyncedGameLocation,
  requestedGameIdFromLocation
} from "@frontend-core/game-route-paths.mts";

import { describe, expect, it } from "vitest";

describe("canonical game route helpers", () => {
  it("reads the requested game id from canonical direct routes", () => {
    expect(requestedGameIdFromLocation("/game/game-123", "")).toBe("game-123");
  });

  it("reads the requested game id from the gameplay bridge query string", () => {
    expect(requestedGameIdFromLocation("/game.html", "?gameId=game-123")).toBe("game-123");
  });

  it("syncs gameplay URLs to the current canonical direct route", () => {
    expect(
      buildSyncedGameLocation("http://127.0.0.1:3100/game.html?gameId=stale", "game-123")
    ).toBe("/game/game-123");
  });

  it("clears the canonical game id back to the gameplay bridge", () => {
    expect(buildSyncedGameLocation("http://127.0.0.1:3100/game/game-123", null)).toBe("/game.html");
  });
});
