const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("non-member user cannot open a protected game from a direct game route", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const outsiderPage = await outsiderContext.newPage();

  const ownerUser = uniqueUser("owner_route");
  const outsiderUser = uniqueUser("outsider_route");
  const gameName = uniqueUser("protetta_route");

  await resetGame(ownerPage);

  await ownerPage.goto("/game.html");
  await registerAndLogin(ownerPage, ownerUser);
  await ownerPage.goto("/lobby.html");
  await ownerPage.locator("#create-game-button").click();
  await expect(ownerPage).toHaveURL(/\/new-game\.html$/);
  await ownerPage.locator("#setup-game-name").fill(gameName);
  await ownerPage.getByRole("button", { name: "Crea e apri" }).click();
  await expect(ownerPage).toHaveURL(/\/game(\/|\.html\?gameId=)/);

  const gameMatch = ownerPage.url().match(/\/game(?:\/|\.html\?gameId=)([^/?#]+)/);
  expect(gameMatch).toBeTruthy();
  const protectedGameId = decodeURIComponent(gameMatch[1]);

  await outsiderPage.goto("/game.html");
  await registerAndLogin(outsiderPage, outsiderUser);
  await outsiderPage.goto("/lobby.html");

  const routeError = outsiderPage.waitForEvent("pageerror");
  await outsiderPage.goto("/game.html?gameId=" + encodeURIComponent(protectedGameId));
  const denialError = await routeError;

  await expect(denialError.message).toMatch(/sessione non valida|fai parte|membro|accesso|autorizzat/i);
  await expect(outsiderPage.locator("#game-status")).toHaveText("Nessuna");
  await expect(outsiderPage.getByRole("button", { name: "Entra nella lobby" })).toBeVisible();

  await ownerContext.close();
  await outsiderContext.close();
});

