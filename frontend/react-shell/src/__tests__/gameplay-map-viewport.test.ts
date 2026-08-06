import { describe, expect, it } from "vitest";

import {
  clampViewportTranslation,
  calculateFittedBoardSize,
  calculateMinimumViewportScale
} from "@react-shell/gameplay-map-viewport";

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

  it("calculates the scale needed to reveal a horizontally cropped mobile board", () => {
    expect(
      calculateMinimumViewportScale({
        boardHeight: 616,
        boardWidth: 741,
        surfaceHeight: 616,
        surfaceWidth: 390
      })
    ).toBeCloseTo(390 / 741, 5);
  });

  it("keeps desktop boards at the default scale and preserves the full-board fit ratio", () => {
    expect(
      calculateMinimumViewportScale({
        boardHeight: 500,
        boardWidth: 760,
        surfaceHeight: 500,
        surfaceWidth: 760
      })
    ).toBe(1);
    expect(
      calculateMinimumViewportScale({
        boardHeight: 500,
        boardWidth: 2000,
        surfaceHeight: 500,
        surfaceWidth: 390
      })
    ).toBeCloseTo(390 / 2000, 5);
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

  it("clamps panning around an off-center safe-area anchor", () => {
    const translation = clampViewportTranslation({
      anchorX: 195,
      anchorY: 289,
      boardHeight: 641,
      boardWidth: 975,
      scale: 1,
      surfaceHeight: 786,
      surfaceWidth: 390,
      translateX: 0,
      translateY: 500,
      viewportBottom: 466,
      viewportTop: 112
    });

    expect(translation.x).toBe(0);
    expect(translation.y).toBeCloseTo(143.5, 5);
  });
});
