const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("non-member user can open a lobby game in spectator mode without auto-joining", async ({ browser }) => {
  test.slow();
  const ownerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const outsiderPage = await outsiderContext.newPage();

  const ownerUser = uniqueUser("owner_auth");
  const outsiderUser = uniqueUser("outsider_auth");
  const gameName = uniqueUser("protetta");

  await resetGame(ownerPage);

  await ownerPage.goto("/game");
  await registerAndLogin(ownerPage, ownerUser);
  await ownerPage.goto("/lobby");
  await ownerPage.locator("#create-game-button").click();
  await expect(ownerPage).toHaveURL(/\/lobby\/new$/);
  await ownerPage.locator("#setup-game-name").fill(gameName);
  await ownerPage.getByRole("button", { name: "Crea e apri" }).click();
  await expect(ownerPage.locator("#game-status")).toContainText(gameName);

  await outsiderPage.goto("/game");
  await registerAndLogin(outsiderPage, outsiderUser);
  await outsiderPage.goto("/lobby");

  const targetRow = outsiderPage.locator("#game-session-list [data-game-id]", { hasText: gameName }).first();
  await expect(targetRow).toBeVisible();
  await targetRow.click();
  await expect(outsiderPage.getByTestId("game-session-details")).toContainText(gameName);

  await outsiderPage.getByRole("button", { name: "Apri selezionata" }).click();

  await expect(outsiderPage).toHaveURL(/\/game\//);
  await expect(outsiderPage.locator("#game-status")).toContainText(gameName);
  await expect(outsiderPage.getByTestId("phase-indicator")).toContainText(/Lobby/i);
  await expect(outsiderPage.getByTestId("current-player-indicator")).not.toContainText(outsiderUser);
  await expect(outsiderPage.locator("#players")).not.toContainText(outsiderUser);
  await expect(outsiderPage.locator("#join-button")).toBeVisible();
  await expect(outsiderPage.locator("#join-button")).toBeEnabled();

  await ownerContext.close();
  await outsiderContext.close();
});

