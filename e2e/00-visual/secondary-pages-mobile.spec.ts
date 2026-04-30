const { test, expect } = require("@playwright/test");
const { preferCommandTheme, resetGame } = require("../support/game-helpers");

test.describe("secondary pages mobile baselines", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("lobby mobile layout matches the baseline", async ({ page }) => {
    test.slow();
    await resetGame(page);
    await preferCommandTheme(page);
    await page.goto("/lobby");
    await expect(page.getByTestId("game-lobby-shell")).toBeVisible();
    await expect(page.locator("#game-list-state")).toContainText("Nessuna partita disponibile.");
    await expect(page.locator("#auth-status")).toContainText("Accedi per aprire e gestire le tue sessioni.");
    await expect(page).toHaveScreenshot("lobby-layout-mobile.png", {
      timeout: 15000,
      maxDiffPixels: 12000
    });
  });

  test("profile mobile layout matches the baseline without a session", async ({ page }) => {
    test.slow();
    await preferCommandTheme(page);
    await page.goto("/profile");
    await expect(page.getByTestId("player-profile-shell")).toBeVisible();
    await expect(page.locator("#profile-feedback")).toContainText("Accedi prima di consultare il profilo giocatore.");
    await expect(page.getByTestId("player-profile-shell")).toHaveScreenshot("profile-layout-mobile.png", {
      timeout: 15000,
      maxDiffPixels: 1200
    });
  });
});
