import {
  buildPlayerCountChoices,
  buildTurnTimeoutHourChoices
} from "@react-shell/game-setup-options";

import { describe, expect, it } from "vitest";

describe("game setup option helpers", () => {
  it("uses backend-compatible player choices when options are unavailable", () => {
    expect(buildPlayerCountChoices(undefined)).toEqual([2, 3, 4]);
  });

  it("honors the server-provided player range when available", () => {
    expect(
      buildPlayerCountChoices({
        playerRange: { min: 3, max: 6 },
        turnTimeoutHoursOptions: []
      })
    ).toEqual([3, 4, 5, 6]);
  });

  it("falls back to supported player choices when the server range has no candidates", () => {
    expect(
      buildPlayerCountChoices({
        playerRange: { min: 7, max: 8 },
        turnTimeoutHoursOptions: []
      })
    ).toEqual([2, 3, 4]);
  });

  it("uses the default turn timeout choices when options are unavailable", () => {
    expect(buildTurnTimeoutHourChoices(undefined)).toEqual([24, 48, 72]);
  });

  it("keeps the first three configured turn timeout choices", () => {
    expect(
      buildTurnTimeoutHourChoices({
        playerRange: { min: 2, max: 4 },
        turnTimeoutHoursOptions: [12, 24, 48, 72]
      })
    ).toEqual([12, 24, 48]);
  });

  it("filters non-integer turn timeout choices", () => {
    expect(
      buildTurnTimeoutHourChoices({
        playerRange: { min: 2, max: 4 },
        turnTimeoutHoursOptions: [12, 24.5, 48]
      })
    ).toEqual([12, 48]);
  });
});
