const { test, expect } = require("@playwright/test");
const { resetGame, uniqueUser } = require("../support/game-helpers.js");

test("user can create a new game, see it in the list, and open it immediately", async ({ page }) => {
  const gameName = uniqueUser("campagna");

  await resetGame(page);
  await page.goto("/");

  const initialOptions = await page.locator("#game-list option").count();

  await page.locator("#game-name").fill(gameName);
  await page.locator("#create-game-button").click();

  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.locator("#game-list")).toHaveValue(/.+/);
  await expect(page.locator("#game-list")).toContainText(gameName);
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i);

  const afterCreateOptions = await page.locator("#game-list option").count();
  expect(afterCreateOptions).toBeGreaterThanOrEqual(initialOptions);

  await page.locator("#game-name").fill(uniqueUser("seconda"));
  await page.locator("#create-game-button").click();
  await expect(page.locator("#game-status")).not.toContainText(gameName);

  const targetValue = await page.locator("#game-list option", { hasText: gameName }).first().getAttribute("value");
  await page.locator("#game-list").selectOption(targetValue);
  await page.locator("#open-game-button").click();

  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i);

  await page.reload();

  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.locator("#game-list")).toContainText(gameName);
  await expect(page.locator("#game-list")).toHaveValue(targetValue);
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i);
});
