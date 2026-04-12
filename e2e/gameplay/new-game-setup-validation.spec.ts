const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("new game setup shows a clear error when the selected map becomes invalid", async ({ page }) => {
  await resetGame(page);
  await page.goto("/game.html");
  await registerAndLogin(page, uniqueUser("setup_invalid"));
  await page.goto("/new-game.html");

  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator('#setup-game-name').fill('Setup Invalid Test');

  await page.evaluate(() => {
    const mapSelect = document.querySelector('#setup-map');
    if (!mapSelect) {
      throw new Error('Missing map select');
    }
    mapSelect.innerHTML = '<option value="invalid-map" selected>Mappa non valida</option>';
    mapSelect.value = 'invalid-map';
  });

  await page.getByRole('button', { name: 'Crea e apri' }).click();

  await expect(page).toHaveURL(/\/new-game\.html$/);
  await expect(page.locator('#new-game-feedback')).toBeVisible();
  await expect(page.locator('#new-game-feedback')).toContainText('La mappa selezionata non e supportata.');
  await expect(page.locator('#submit-new-game')).toBeEnabled();
});

