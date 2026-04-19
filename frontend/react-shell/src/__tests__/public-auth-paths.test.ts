import { normalizeNextPath } from "@react-shell/public-auth-paths";

import { describe, expect, it } from "vitest";

describe("normalizeNextPath", () => {
  it("maps extensionless canonical lobby routes to declared canonical documents", () => {
    expect(normalizeNextPath("/lobby", "/lobby.html")).toBe("/lobby.html");
    expect(normalizeNextPath("/lobby/new?mode=quick", "/lobby.html")).toBe(
      "/new-game.html?mode=quick"
    );
    expect(normalizeNextPath("/profile?tab=stats", "/lobby.html")).toBe("/profile.html?tab=stats");
  });

  it("keeps react next paths inside the react namespace", () => {
    expect(normalizeNextPath("/lobby?tab=stats", "/react/lobby")).toBe("/react/lobby?tab=stats");
  });

  it("falls back for reserved auth destinations", () => {
    expect(normalizeNextPath("/login", "/lobby.html")).toBe("/lobby.html");
    expect(normalizeNextPath("/react/register", "/react/lobby")).toBe("/react/lobby");
  });
});
