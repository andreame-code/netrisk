const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("creator can reopen a protected lobby from a direct game route", async ({ page }) => {
  test.slow();
  const ownerUser = uniqueUser("owner_route_self");
  const gameName = uniqueUser("protetta_route_self");

  await resetGame(page);

  await page.goto("/game");
  await registerAndLogin(page, ownerUser);
  await page.goto("/lobby/new");
  await expect(page).toHaveURL(/\/lobby\/new$/);
  await page.locator("#setup-game-name").fill(gameName);
  await page.getByRole("button", { name: "Crea e apri" }).click();
  await expect(page).toHaveURL(/\/game(\/|\.html\?gameId=)/);

  const gameMatch = page.url().match(/\/game(?:\/|\.html\?gameId=)([^/?#]+)/);
  expect(gameMatch).toBeTruthy();
  const protectedGameId = decodeURIComponent(gameMatch[1]);

  await page.goto("/lobby");
  await page.goto("/game.html?gameId=" + encodeURIComponent(protectedGameId));

  await expect(page).toHaveURL(new RegExp("/game/" + protectedGameId + "$"));
  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i);
  await expect(page.locator("#auth-status")).not.toContainText("Accesso richiesto");
  await expect(page.getByRole("button", { name: "Avvia partita" })).toBeVisible();
});
