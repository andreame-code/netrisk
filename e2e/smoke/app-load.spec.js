const { test, expect } = require("@playwright/test");
const { resetGame } = require("../support/game-helpers.js");

test("main page loads", async ({ page }) => {
  await resetGame(page);
  await page.goto("/");

  await expect(page).toHaveTitle(/Frontline Dominion/i);
  await expect(page.locator(".ld-hero")).toBeVisible();
  await expect(page.locator("#top").getByRole("link", { name: "Registrati" })).toBeVisible();
});
