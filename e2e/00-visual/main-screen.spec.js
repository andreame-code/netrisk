const { test, expect } = require("@playwright/test");
const { resetGame } = require("../support/game-helpers.js");

test("battlefield layout matches the baseline", async ({ page }) => {
  await resetGame(page);
  await page.goto("/");
  await expect(page.getByTestId("battlefield-layout")).toHaveScreenshot("battlefield-layout.png");
});
