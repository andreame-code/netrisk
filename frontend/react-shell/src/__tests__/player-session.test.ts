import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCurrentPlayerId,
  readCurrentPlayerId,
  storeCurrentPlayerId,
  subscribeCurrentPlayerIdChanges
} from "@react-shell/player-session";

const PLAYER_ID_STORAGE_KEY = "frontline-player-id";

beforeEach(() => {
  window.localStorage.clear();
});

describe("player-session", () => {
  it("recovers from invalid stored JSON when saving the player id", () => {
    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, "invalid-json");

    storeCurrentPlayerId("player-1", "game-1");

    expect(readCurrentPlayerId("game-1")).toBe("player-1");
  });

  it("notifies subscribers when the stored player id changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCurrentPlayerIdChanges(listener);

    storeCurrentPlayerId("player-1", "game-1");
    clearCurrentPlayerId();

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    storeCurrentPlayerId("player-2", "game-2");

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("removes only the requested game mapping when playerId is missing", () => {
    storeCurrentPlayerId("player-1", "game-1");
    storeCurrentPlayerId("player-2", "game-2");

    storeCurrentPlayerId(null, "game-1");

    expect(readCurrentPlayerId("game-1")).toBeNull();
    expect(readCurrentPlayerId("game-2")).toBe("player-2");
  });
});
