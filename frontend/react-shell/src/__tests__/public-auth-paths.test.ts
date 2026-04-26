import { normalizeNextPath } from "@react-shell/public-auth-paths";

import { describe, expect, it } from "vitest";

describe("normalizeNextPath", () => {
  it("keeps react next paths inside the react namespace", () => {
    expect(normalizeNextPath("/lobby?tab=stats", "/react/lobby")).toBe("/react/lobby?tab=stats");
    expect(normalizeNextPath("/game/g-42", "/react/lobby")).toBe("/react/game/g-42");
  });

  it("falls back for reserved auth destinations", () => {
    expect(normalizeNextPath("/login", "/lobby")).toBe("/lobby");
    expect(normalizeNextPath("/react/register", "/react/lobby")).toBe("/react/lobby");
  });
});
