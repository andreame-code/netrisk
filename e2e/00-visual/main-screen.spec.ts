const { test, expect } = require("@playwright/test");
const { resetGame } = require("../support/game-helpers");

test("battlefield layout matches the baseline", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto("/game.html");
  await expect(page.locator("#map [data-territory-id]")).toHaveCount(9);
  await page.waitForTimeout(300);
  await expect(page.getByTestId("battlefield-layout")).toHaveScreenshot("battlefield-layout.png", {
    timeout: 15000,
    maxDiffPixels: 5000
  });
});

