const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("legacy gameplay fallback stays on the legacy route across reloads", async ({ page }) => {
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
  const expectedLegacyUrl = `/legacy/game.html?gameId=${encodeURIComponent(gameId)}`;

  await page.goto(expectedLegacyUrl);
  await expect(page).toHaveURL(new RegExp(`${expectedLegacyUrl.replace("?", "\\?")}$`));
  await expect(page.locator("#game-status")).toContainText(gameName);

  await page.reload();

  await expect(page).toHaveURL(new RegExp(`${expectedLegacyUrl.replace("?", "\\?")}$`));
  await expect(page.locator("#game-status")).toContainText(gameName);
});
