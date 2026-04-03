const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("non-member user cannot open a protected game from the lobby", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const outsiderPage = await outsiderContext.newPage();

  const ownerUser = uniqueUser("owner_auth");
  const outsiderUser = uniqueUser("outsider_auth");
  const gameName = uniqueUser("protetta");

  await resetGame(ownerPage);

  await ownerPage.goto("/game.html");
  await registerAndLogin(ownerPage, ownerUser);
  await ownerPage.goto("/lobby.html");
  await ownerPage.locator("#create-game-button").click();
  await expect(ownerPage).toHaveURL(/\/new-game\.html$/);
  await ownerPage.locator("#setup-game-name").fill(gameName);
  await ownerPage.getByRole("button", { name: "Crea e apri" }).click();
  await expect(ownerPage.locator("#game-status")).toContainText(gameName);

  await outsiderPage.goto("/game.html");
  await registerAndLogin(outsiderPage, outsiderUser);
  await outsiderPage.goto("/lobby.html");

  const targetRow = outsiderPage.locator("#game-session-list [data-game-id]", { hasText: gameName }).first();
  await expect(targetRow).toBeVisible();
  await targetRow.click();
  await expect(outsiderPage.getByTestId("game-session-details")).toContainText(gameName);

  await outsiderPage.getByRole("button", { name: "Apri selezionata" }).click();

  await expect(outsiderPage).toHaveURL(/\/lobby\.html$/);
  await expect(outsiderPage.getByTestId("game-session-details")).toContainText(gameName);
  await expect(outsiderPage.locator("#game-list-state")).toContainText(/fai parte|membro|accesso|autorizzat/i);

  await ownerContext.close();
  await outsiderContext.close();
});

