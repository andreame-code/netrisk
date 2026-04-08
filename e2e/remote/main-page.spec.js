const { test, expect } = require("@playwright/test");

test("remote main page loads the core shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Frontline Dominion/i);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("map-region")).toBeAttached();
  await expect(page.locator("#auth-status")).toBeVisible();
});
