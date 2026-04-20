const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("legacy rollback pages stay available under /legacy after the clean-route cutover", async ({
  page
}) => {
  test.slow();
  const ownerUser = uniqueUser("legacy_route_owner");
  const gameName = uniqueUser("legacy_route_game");

  await resetGame(page);

  await page.goto("/game");
  await registerAndLogin(page, ownerUser);
  await page.goto("/lobby/new");
  await expect(page).toHaveURL(/\/lobby\/new$/);
  await page.locator("#setup-game-name").fill(gameName);
  await page.getByRole("button", { name: "Crea e apri" }).click();
  await expect(page).toHaveURL(/\/game\/[^/?#]+$/);

  const gameMatch = page.url().match(/\/game\/([^/?#]+)/);
  expect(gameMatch).toBeTruthy();
  const gameId = decodeURIComponent(gameMatch[1]);
  const retiredLegacyUrl = `/legacy/game.html?gameId=${encodeURIComponent(gameId)}`;

  const legacyResponse = await page.goto(retiredLegacyUrl);
  expect(legacyResponse).toBeTruthy();
  expect(legacyResponse.status()).toBe(200);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.locator("#game-status")).toContainText(gameName);
});
