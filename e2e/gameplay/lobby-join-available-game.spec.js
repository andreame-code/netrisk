const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("user can join an available lobby game directly from the lobby list", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const joinerPage = await joinerContext.newPage();

  const ownerUser = uniqueUser("owner_join");
  const joinerUser = uniqueUser("joiner_lobby");
  const gameName = uniqueUser("joinable");

  await resetGame(ownerPage);

  await ownerPage.goto("/game.html");
  await registerAndLogin(ownerPage, ownerUser);
  await ownerPage.goto("/lobby.html");
  await ownerPage.locator("#create-game-button").click();
  await expect(ownerPage).toHaveURL(/\/new-game\.html$/);
  await ownerPage.locator("#setup-game-name").fill(gameName);
  await ownerPage.getByRole("button", { name: "Crea e apri" }).click();
  await expect(ownerPage.locator("#game-status")).toContainText(gameName);
  await expect(ownerPage.getByTestId("phase-indicator")).toContainText(/Lobby/i);

  await joinerPage.goto("/game.html");
  await registerAndLogin(joinerPage, joinerUser);
  await joinerPage.goto("/lobby.html");

  const targetRow = joinerPage.locator("#game-session-list [data-game-id]", { hasText: gameName }).first();
  await expect(targetRow).toBeVisible();
  const targetValue = await targetRow.getAttribute("data-game-id");
  await targetRow.click();

  await expect(joinerPage.getByTestId("game-session-details")).toContainText(gameName);
  await expect(joinerPage.getByRole("button", { name: "Unisciti e apri" })).toBeVisible();
  await joinerPage.getByRole("button", { name: "Unisciti e apri" }).click();

  await expect(joinerPage).toHaveURL(new RegExp("/game/" + targetValue + "$"));
  await expect(joinerPage.locator("#game-status")).toContainText(gameName);
  await expect(joinerPage.getByTestId("phase-indicator")).toContainText(/Lobby/i);
  await expect(joinerPage.getByTestId("current-player-indicator")).toContainText(joinerUser);
  await expect(joinerPage.locator("#players")).toContainText(joinerUser);

  await ownerContext.close();
  await joinerContext.close();
});
