const { test, expect } = require("@playwright/test");

test("remote profile page shows the guest fallback without a session", async ({ page }) => {
  await page.goto("/profile.html");

  await expect(page.getByTestId("player-profile-shell")).toBeVisible();
  await expect(page.locator("#profile-feedback")).toBeVisible();
  await expect(page.locator("#profile-content")).toHaveAttribute("hidden", "");
  await expect(page.locator("#logout-button")).toBeHidden();
});
