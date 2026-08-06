const { test, expect } = require("@playwright/test");
const {
  attachSessionCookie,
  createAuthenticatedSession,
  preferCommandTheme,
  resetGame,
  setSessionThemePreference
} = require("../support/game-helpers");

async function authenticateVisualUser(page, username) {
  const sessionToken = await createAuthenticatedSession(page, username);
  await setSessionThemePreference(page, sessionToken, "command");
  await attachSessionCookie(page, sessionToken);
}

test("lobby layout matches the baseline", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await preferCommandTheme(page);
  await page.goto("/lobby");
  await expect(page.getByTestId("game-lobby-shell")).toBeVisible();
  await expect(page.locator("#game-list-state")).toContainText("Nessuna partita disponibile.");
  await expect(page.locator("#auth-status")).toContainText(
    "Accedi per aprire e gestire le tue sessioni."
  );
  await expect(page).toHaveScreenshot("lobby-layout.png", {
    timeout: 15000,
    maxDiffPixels: 10000
  });
});

test("new game setup layout matches the baseline", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await preferCommandTheme(page);
  await authenticateVisualUser(page, "visualsetup");
  await page.goto("/lobby/new");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await expect(page.locator("#setup-player-slots [data-slot-index]")).toHaveCount(2);
  await expect(page.getByTestId("new-game-shell")).toHaveScreenshot("new-game-layout.png", {
    timeout: 15000,
    maxDiffPixels: 500
  });
});

test("authenticated profile layout matches the baseline", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await preferCommandTheme(page);
  await authenticateVisualUser(page, "visualprofile");
  await page.goto("/profile");
  await expect(page.getByTestId("player-profile-shell")).toBeVisible();
  await expect(page.getByTestId("react-shell-profile-empty")).toBeVisible();
  await expect(page.getByTestId("player-profile-shell")).toHaveScreenshot("profile-layout.png", {
    timeout: 15000,
    maxDiffPixels: 500
  });
});
