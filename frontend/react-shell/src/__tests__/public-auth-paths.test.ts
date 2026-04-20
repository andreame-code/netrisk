import { normalizeNextPath } from "@react-shell/public-auth-paths";

import { describe, expect, it } from "vitest";

describe("normalizeNextPath", () => {
  it("maps legacy document routes to clean canonical routes", () => {
    expect(normalizeNextPath("/lobby.html", "/lobby")).toBe("/lobby");
    expect(normalizeNextPath("/new-game.html?mode=quick", "/lobby")).toBe("/lobby/new?mode=quick");
    expect(normalizeNextPath("/profile.html?tab=stats", "/lobby")).toBe("/profile?tab=stats");
    expect(normalizeNextPath("/game.html?gameId=g-42", "/lobby")).toBe("/game/g-42");
  });

  it("keeps react next paths inside the react namespace", () => {
    expect(normalizeNextPath("/lobby?tab=stats", "/react/lobby")).toBe("/react/lobby?tab=stats");
    expect(normalizeNextPath("/lobby.html?tab=stats", "/react/lobby")).toBe(
      "/react/lobby?tab=stats"
    );
  });

  it("falls back for reserved auth destinations", () => {
    expect(normalizeNextPath("/login", "/lobby")).toBe("/lobby");
    expect(normalizeNextPath("/react/register", "/react/lobby")).toBe("/react/lobby");
  });
});
