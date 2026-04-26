import {
  buildSyncedGameLocation,
  requestedGameIdFromLocation
} from "@frontend-core/game-route-paths.mts";

import { describe, expect, it } from "vitest";

describe("canonical game route helpers", () => {
  it("reads the requested game id from canonical direct routes", () => {
    expect(requestedGameIdFromLocation("/game/game-123", "")).toBe("game-123");
  });

  it("reads the requested game id from react alias routes", () => {
    expect(requestedGameIdFromLocation("/react/game/game-123", "")).toBe("game-123");
  });

  it("syncs gameplay URLs to the current canonical direct route", () => {
    expect(buildSyncedGameLocation("http://127.0.0.1:3100/game?gameId=stale", "game-123")).toBe(
      "/game/game-123"
    );
  });

  it("clears the canonical game id back to the clean gameplay root", () => {
    expect(buildSyncedGameLocation("http://127.0.0.1:3100/game/game-123", null)).toBe("/game");
  });
});
