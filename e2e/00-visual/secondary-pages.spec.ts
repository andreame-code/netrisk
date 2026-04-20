const { test, expect } = require("@playwright/test");
const { resetGame } = require("../support/game-helpers");

test("lobby layout matches the baseline", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await page.goto("/lobby");
  await expect(page.getByTestId("game-lobby-shell")).toBeVisible();
  await expect(page.locator("#game-list-state")).toContainText("Nessuna partita disponibile.");
  await expect(page.locator("#auth-status")).toContainText("Accedi per aprire e gestire le tue sessioni.");
  await expect(page).toHaveScreenshot("lobby-layout.png", {
    timeout: 15000,
    maxDiffPixels: 10000
  });
});

test("new game setup layout matches the baseline", async ({ page }) => {
  test.slow();
  await page.goto("/lobby/new");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await expect(page.locator("#setup-player-slots [data-slot-index]")).toHaveCount(2);
  await expect(page.getByTestId("new-game-shell")).toHaveScreenshot("new-game-layout.png", {
    timeout: 15000,
    maxDiffPixels: 500
  });
});

test("profile layout matches the baseline without a session", async ({ page }) => {
  test.slow();
  await page.goto("/profile");
  await expect(page.getByTestId("player-profile-shell")).toBeVisible();
  await expect(page.locator("#profile-feedback")).toContainText("Accedi prima di consultare il profilo giocatore.");
  await expect(page.getByTestId("player-profile-shell")).toHaveScreenshot("profile-layout.png", {
    timeout: 15000,
    maxDiffPixels: 500
  });
});
