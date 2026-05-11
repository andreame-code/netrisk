import { describe, expect, it } from "vitest";

import { calculateFittedBoardSize } from "@react-shell/gameplay-map-viewport";

describe("GameplayMapViewport fitting", () => {
  it("keeps portrait maps within the available height when horizontal crop is enabled", () => {
    const frame = calculateFittedBoardSize({
      allowsHorizontalCrop: true,
      aspectRatio: 463 / 800,
      availableHeight: 640,
      availableWidth: 390,
      stagePaddingY: 24
    });

    expect(frame.width).toBeLessThan(390);
    expect(frame.height).toBeLessThanOrEqual(640);
  });

  it("allows horizontal crop for wide maps that can still fit vertically", () => {
    const frame = calculateFittedBoardSize({
      allowsHorizontalCrop: true,
      aspectRatio: 16 / 9,
      availableHeight: 640,
      availableWidth: 390,
      stagePaddingY: 24
    });

    expect(frame.width).toBeGreaterThan(390);
    expect(frame.width).toBeLessThanOrEqual(390 * 1.9);
    expect(frame.height).toBeLessThanOrEqual(640);
  });
});
