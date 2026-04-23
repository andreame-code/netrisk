import { readCurrentPlayerId } from "@react-shell/player-session";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("player session storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("returns null when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(readCurrentPlayerId("g-1")).toBeNull();
  });
});
