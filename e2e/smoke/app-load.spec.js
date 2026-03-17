const { test, expect } = require("@playwright/test");

test("main page loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Frontline Dominion/i);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("map-region")).toBeVisible();
});
