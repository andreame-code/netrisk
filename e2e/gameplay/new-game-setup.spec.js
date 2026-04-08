const { test, expect } = require("@playwright/test");
const { createEngineRuleset, registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

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

test("engine studio salva un ruleset Middle-earth e la nuova partita lo rende correttamente", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await page.goto("/game.html");
  const owner = uniqueUser("middle_earth_owner");
  await registerAndLogin(page, owner);
  const rulesetName = `Middle-earth Expedition ${Date.now().toString(36).slice(-4)}`;

  await page.goto("/engine.html");
  await expect(page.locator("#engine-ruleset-name")).toBeVisible();
  await page.locator("#engine-ruleset-name").fill(rulesetName);
  await page.locator("#engine-ruleset-description").fill("Middle-earth from Engine Studio");
  await page.locator("#engine-ruleset-map").selectOption("middle-earth");
  await page.locator("#engine-ruleset-piece-theme").selectOption("classic-commanders");
  await page.locator("#engine-ruleset-victory").selectOption("domination");
  await page.locator("#engine-ruleset-combat").selectOption("standard");
  await page.locator("#engine-ruleset-save").click();
  await expect(page.locator("#engine-feedback")).toContainText("Ruleset salvato.");

  await page.goto("/new-game.html");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-ruleset").selectOption({ label: rulesetName });
  await expect(page.locator("#setup-map")).toHaveValue("middle-earth");
  await page.locator("#setup-game-name").fill("War of the Ring");
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/game(\/|\.html\?gameId=)/);
  await expect(page.locator("#game-status")).toContainText("War of the Ring", { timeout: 15000 });
  await expect(page.locator("#game-map-meta")).toContainText("Middle-earth", { timeout: 15000 });

  const mapBoard = page.locator(".map-board.has-custom-background");
  await expect(mapBoard).toBeVisible();
  await expect(mapBoard).toHaveAttribute("style", /middle-earth\.jpg/);
  await expect(page.locator('[data-territory-id="the_shire"]')).toHaveAttribute("title", "The Shire");
  await expect(page.locator('[data-territory-id="gondor"]')).toBeVisible();
  await expect(page.locator('[data-territory-id="mordor"]')).toBeVisible();
});

test("new game setup crea e rende una mappa World Classic tramite ruleset custom", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await page.goto("/game.html");
  const owner = uniqueUser("world_classic_owner");
  await registerAndLogin(page, owner);
  const ruleset = await createEngineRuleset(page, {
    name: `World Classic Ruleset ${Date.now().toString(36).slice(-4)}`,
    description: "World Classic seed map",
    mapId: "world-classic",
    combatRuleId: "standard-3-defense"
  });
  await page.goto("/new-game.html");

  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-ruleset").selectOption(ruleset.id);
  await expect(page.locator("#setup-map")).toHaveValue("world-classic");
  await page.locator("#setup-game-name").fill("Global Conflict");
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/game(\/|\.html\?gameId=)/);
  await expect(page.locator("#game-status")).toContainText("Global Conflict", { timeout: 15000 });
  await expect(page.locator("#game-map-meta")).toContainText("World Classic", { timeout: 15000 });
  const mapBoard = page.locator(".map-board.has-custom-background");
  await expect(mapBoard).toBeVisible();
  await expect(mapBoard).toHaveAttribute("style", /world-classic\.png/);
  await expect(page.locator('[data-territory-id="alaska"]')).toHaveAttribute("title", "Alaska");
  await expect(page.locator('[data-territory-id="ukraine"]')).toBeVisible();
  await expect(page.locator('[data-territory-id="eastern_australia"]')).toBeVisible();

  const stateResponse = await page.request.get("/api/state");
  await expect(stateResponse.ok()).toBeTruthy();
  const statePayload = await stateResponse.json();
  expect(statePayload.diceRuleSet.id).toBe("standard-3-defense");
});


