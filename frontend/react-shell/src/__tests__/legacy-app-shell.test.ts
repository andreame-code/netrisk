import { describe, expect, it } from "vitest";

import { resolveCurrentGameId } from "@react-shell/legacy-app-shell";

describe("resolveCurrentGameId", () => {
  it("returns the decoded path game id for valid route segments", () => {
    expect(resolveCurrentGameId("/react/game/test%20game", "")).toBe("test game");
  });

  it("falls back to the raw segment when the route contains malformed percent encoding", () => {
    expect(() => resolveCurrentGameId("/react/game/%E0%A4%A", "")).not.toThrow();
    expect(resolveCurrentGameId("/react/game/%E0%A4%A", "")).toBe("%E0%A4%A");
  });
});
