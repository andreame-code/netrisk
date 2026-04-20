const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("legacy gameplay routes are no longer served after the React cutover cleanup", async ({
  page
}) => {
  test.slow();
  const ownerUser = uniqueUser("legacy_route_owner");
  const gameName = uniqueUser("legacy_route_game");

  await resetGame(page);

  await page.goto("/game.html");
  await registerAndLogin(page, ownerUser);
  await page.goto("/new-game.html");
  await expect(page).toHaveURL(/\/new-game\.html$/);
  await page.locator("#setup-game-name").fill(gameName);
  await page.getByRole("button", { name: "Crea e apri" }).click();
  await expect(page).toHaveURL(/\/game\/[^/?#]+$/);

  const gameMatch = page.url().match(/\/game\/([^/?#]+)/);
  expect(gameMatch).toBeTruthy();
  const gameId = decodeURIComponent(gameMatch[1]);
  const retiredLegacyUrl = `/legacy/game.html?gameId=${encodeURIComponent(gameId)}`;

  const legacyResponse = await page.goto(retiredLegacyUrl);
  expect(legacyResponse).toBeTruthy();
  expect(legacyResponse.status()).toBe(404);
  await expect(page.locator("body")).toContainText("File non trovato.");
});
