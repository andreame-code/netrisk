const { test, expect } = require("@playwright/test");
const { resetGame } = require("../support/game-helpers.js");

test("main page loads", async ({ page }) => {
  await resetGame(page);
  await page.goto("/");

  await expect(page).toHaveTitle(/Frontline Dominion/i);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("map-region")).toBeVisible();
});
