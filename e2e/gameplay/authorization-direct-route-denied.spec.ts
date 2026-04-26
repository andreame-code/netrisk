const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("non-member user cannot open a protected game from a direct game route", async ({ browser }) => {
  test.slow();
  const ownerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const outsiderPage = await outsiderContext.newPage();

  const ownerUser = uniqueUser("owner_route");
  const outsiderUser = uniqueUser("outsider_route");
  const gameName = uniqueUser("protetta_route");

  await resetGame(ownerPage);

  await ownerPage.goto("/game");
  await registerAndLogin(ownerPage, ownerUser);
  await ownerPage.goto("/lobby/new");
  await expect(ownerPage).toHaveURL(/\/lobby\/new$/);
  await ownerPage.locator("#setup-game-name").fill(gameName);
  await ownerPage.getByRole("button", { name: "Crea e apri" }).click();
  await expect(ownerPage).toHaveURL(/\/game\//);

  const gameMatch = ownerPage.url().match(/\/game\/([^/?#]+)/);
  expect(gameMatch).toBeTruthy();
  const protectedGameId = decodeURIComponent(gameMatch[1]);

  await outsiderPage.goto("/game");
  await registerAndLogin(outsiderPage, outsiderUser);
  await outsiderPage.goto("/lobby");
  await outsiderPage.goto("/game/" + encodeURIComponent(protectedGameId));

  await expect(outsiderPage.locator("#game-status")).toContainText(gameName);
  await expect(outsiderPage.getByTestId("phase-indicator")).toContainText(/Lobby/i);
  await expect(outsiderPage.getByTestId("current-player-indicator")).not.toContainText(outsiderUser);
  await expect(outsiderPage.locator("#players")).not.toContainText(outsiderUser);
  await expect(outsiderPage.getByRole("button", { name: "Entra nella lobby" })).toBeVisible();
  await expect(outsiderPage.getByRole("button", { name: "Entra nella lobby" })).toBeEnabled();

  await ownerContext.close();
  await outsiderContext.close();
});
