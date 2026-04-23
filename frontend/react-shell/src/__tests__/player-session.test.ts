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

  it("reads legacy digit-only player ids", () => {
    window.localStorage.setItem("frontline-player-id", "00123");

    expect(readCurrentPlayerId("g-1")).toBe("00123");
  });
});
