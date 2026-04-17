const { test, expect } = require("@playwright/test");

const { resetGame } = require("../support/game-helpers");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("react shell route loads with controlled fallback state", async ({ page }) => {
  await resetGame(page);

  await page.route("**/api/auth/session", async (route) => {
    await delay(150);
    await route.continue();
  });

  await page.route("**/api/games", async (route) => {
    await delay(150);
    await route.continue();
  });

  await page.goto("/react/");

  await expect(page).toHaveTitle(/NetRisk React Shell/i);
  await expect(page.getByTestId("react-shell-loading")).toBeVisible();
  await expect(page.getByTestId("react-shell-ready")).toBeVisible();
  await expect(page.getByTestId("react-shell-session-status")).toContainText(/Authenticated|Guest/i);
  await expect(page.getByTestId("react-shell-games-status")).toContainText(/Loaded|Fallback/i);
  await expect(page.getByTestId("react-shell-games-panel")).toBeVisible();
});
