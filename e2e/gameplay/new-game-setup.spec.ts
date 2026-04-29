const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("new game setup keeps player 1 locked as creator and creates the configured session", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await page.goto("/game");
  const owner = uniqueUser("setup_owner");
  await registerAndLogin(page, owner);
  await page.goto("/lobby/new");

  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await expect(page.locator("#setup-ruleset")).toBeVisible();
  await expect(page.locator("#setup-ruleset")).toContainText("Classic Defense 3");
  await expect(page.locator("#setup-map")).toBeEnabled();
  await expect(page.locator("#setup-dice-ruleset")).toBeHidden();

  await page.locator("#setup-ruleset").selectOption("classic-defense-3");
  await expect(page.locator("#setup-ruleset-summary")).toContainText("Defense 3 Dice");

  await page.locator("#setup-customize-options").check();
  await expect(page.locator("#setup-dice-ruleset")).toBeVisible();
  await expect(page.locator("#setup-victory-ruleset")).toBeVisible();
  await expect(page.locator("#setup-theme")).toBeVisible();
  await expect(page.locator("#setup-piece-skin")).toBeVisible();
  await expect(page.locator("#setup-dice-ruleset")).toContainText("Defense 3 Dice");
  await expect(page.locator("#setup-victory-ruleset")).toContainText("Conquest");
  await expect(page.locator("#setup-victory-ruleset")).toContainText("Majority Control");
  await expect(page.locator("#setup-theme")).toContainText("Midnight");
  await expect(page.locator("#setup-theme")).toContainText("Ember");
  await expect(page.locator("#setup-theme")).toContainText("War Table");
  await expect(page.locator("#setup-piece-skin")).toContainText("Command Ring");
  await expect(page.locator("#setup-map")).toBeEnabled();
  await page.locator("#setup-victory-ruleset").selectOption("majority-control");
  await page.locator("#setup-theme").selectOption("ember");
  await page.locator("#setup-piece-skin").selectOption("command-ring");
  await expect(page.locator("#setup-ruleset-summary")).toContainText("Majority Control");
  await expect(page.locator("#setup-ruleset-summary")).toContainText("Ember");
  await expect(page.locator("#setup-ruleset-summary")).toContainText("Command Ring");

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

  await expect(page).toHaveURL(/\/game\//);
  await expect(page.locator('#game-status')).toContainText('Setup Lock Test');
  await expect(page.locator('#game-map-meta')).toContainText('Classic Mini');
  await expect(page.locator('#game-setup-meta')).toContainText('4 giocatori');
  await expect(page.locator('#game-setup-meta')).toContainText('2 AI');
  await expect(page.getByTestId('current-player-indicator')).toContainText(owner);
  await expect(page.locator('#join-button')).toBeDisabled();
  await expect(page.locator('.territory-node').first()).toHaveClass(/piece-skin-style-ring-core/);
});

test("new game setup creates and renders the selected Middle-earth map", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await page.goto("/game");
  const owner = uniqueUser("middle_earth_owner");
  await registerAndLogin(page, owner);
  await page.goto("/lobby/new");

  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await expect(page.locator("#setup-map")).toContainText("Middle-earth");

  await page.locator("#setup-map").selectOption("middle-earth");
  await page.locator("#setup-game-name").fill("War of the Ring");
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/game\//);
  await expect(page.locator("#game-status")).toContainText("War of the Ring", { timeout: 15000 });
  await expect(page.locator("#game-map-meta")).toContainText("Middle-earth", { timeout: 15000 });

  const mapBoard = page.locator(".map-board.has-custom-background");
  await expect(mapBoard).toBeVisible();
  await expect(mapBoard).toHaveAttribute("style", /middle-earth\.jpg/);
  await expect(page.locator('[data-territory-id="the_shire"]')).toHaveAttribute("title", "The Shire");
  await expect(page.locator('[data-territory-id="gondor"]')).toBeVisible();
  await expect(page.locator('[data-territory-id="mordor"]')).toBeVisible();
});

test("new game setup creates and renders the selected World Classic map", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await page.goto("/game");
  const owner = uniqueUser("world_classic_owner");
  await registerAndLogin(page, owner);
  await page.goto("/lobby/new");

  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await expect(page.locator("#setup-map")).toContainText("World Classic");

  await page.locator("#setup-map").selectOption("world-classic");
  await page.locator("#setup-game-name").fill("Global Conflict");
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/game\//);
  await expect(page.locator("#game-status")).toContainText("Global Conflict", { timeout: 15000 });
  await expect(page.locator("#game-map-meta")).toContainText("World Classic", { timeout: 15000 });
  const mapBoard = page.locator(".map-board.has-custom-background");
  await expect(mapBoard).toBeVisible();
  await expect(mapBoard).toHaveAttribute("style", /world-classic\.png/);
  await expect(page.locator('[data-territory-id="alaska"]')).toHaveAttribute("title", "Alaska");
  await expect(page.locator('[data-territory-id="ukraine"]')).toBeVisible();
  await expect(page.locator('[data-territory-id="eastern_australia"]')).toBeVisible();
});
