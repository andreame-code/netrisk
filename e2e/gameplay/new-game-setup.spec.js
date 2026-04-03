const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("new game setup keeps player 1 locked as creator and creates the configured session", async ({ page }) => {
  await resetGame(page);
  await page.goto("/game.html");
  const owner = uniqueUser("setup_owner");
  await registerAndLogin(page, owner);
  await page.goto("/new-game.html");

  await expect(page.getByTestId("new-game-shell")).toBeVisible();

  const slotOne = page.locator('[data-slot-index="0"]');
  await expect(slotOne).toContainText("Player 1");
  await expect(slotOne).toContainText("Creator");
  await expect(slotOne).toContainText("Human");
  await expect(slotOne.locator('select')).toHaveCount(0);

  await page.locator('#setup-total-players').selectOption('4');
  await expect(page.locator('[data-slot-index]')).toHaveCount(4);
  await expect(slotOne.locator('select')).toHaveCount(0);
  await expect(page.locator('[data-slot-index="1"] select[data-role="type"]')).toHaveCount(1);
  await expect(page.locator('[data-slot-index="2"] select[data-role="type"]')).toHaveCount(1);
  await expect(page.locator('[data-slot-index="3"] select[data-role="type"]')).toHaveCount(1);

  await page.locator('[data-slot-index="1"] select[data-role="type"]').selectOption('ai');
  await page.locator('[data-slot-index="2"] select[data-role="type"]').selectOption('human');
  await page.locator('[data-slot-index="3"] select[data-role="type"]').selectOption('ai');

  await page.locator('#setup-game-name').fill('Setup Lock Test');
  await page.getByRole('button', { name: 'Crea e apri' }).click();

  await expect(page).toHaveURL(/\/game(\/|\.html\?gameId=)/);
  await expect(page.locator('#game-status')).toContainText('Setup Lock Test');
  await expect(page.locator('#game-map-meta')).toContainText('Classic Mini');
  await expect(page.locator('#game-setup-meta')).toContainText('4 giocatori');
  await expect(page.locator('#game-setup-meta')).toContainText('2 AI');
  await expect(page.getByTestId('current-player-indicator')).toContainText(owner);
  await expect(page.locator('#join-button')).toBeDisabled();
});


