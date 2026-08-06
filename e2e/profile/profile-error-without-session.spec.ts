const { test, expect } = require("@playwright/test");

test("profile page requests login when no session is available", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
  await expect(page.getByTestId("player-profile-shell")).toHaveCount(0);
  await expect(page.locator("#profile-feedback")).toHaveCount(0);
});
