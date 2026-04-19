import {
  buildSyncedGameLocation,
  requestedGameIdFromLocation
} from "@frontend-core/game-route-paths.mts";

import { describe, expect, it } from "vitest";

describe("legacy and canonical game route helpers", () => {
  it("reads the requested game id from canonical direct routes", () => {
    expect(requestedGameIdFromLocation("/game/game-123", "")).toBe("game-123");
  });

  it("keeps legacy gameplay URLs inside the legacy namespace during sync", () => {
    expect(
      buildSyncedGameLocation("http://127.0.0.1:3100/legacy/game.html?gameId=stale", "game-123")
    ).toBe("/legacy/game.html?gameId=game-123");
  });

  it("clears the legacy game id without escaping back to the canonical route", () => {
    expect(
      buildSyncedGameLocation("http://127.0.0.1:3100/legacy/game.html?gameId=game-123", null)
    ).toBe("/legacy/game.html");
  });
});
