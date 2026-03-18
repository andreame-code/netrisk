const { test, expect } = require("@playwright/test");
const { resetGame, uniqueUser } = require("../support/game-helpers.js");

test("user can create a new game, see it in the list, and open it immediately", async ({ page }) => {
  const gameName = uniqueUser("campagna");

  await resetGame(page);
  await page.goto("/lobby.html");

  const initialOptions = await page.locator("#game-session-list [data-game-id]").count();

  await page.locator("#game-name").fill(gameName);
  await page.locator("#create-game-button").click();

  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.getByTestId("game-session-list")).toContainText(gameName);
  await expect(page.getByTestId("game-session-details")).toContainText(gameName);

  const afterCreateOptions = await page.locator("#game-session-list [data-game-id]").count();
  expect(afterCreateOptions).toBeGreaterThanOrEqual(initialOptions);

  await page.locator("#game-name").fill(uniqueUser("seconda"));
  await page.locator("#create-game-button").click();
  await expect(page.locator("#game-status")).not.toContainText(gameName);

  const targetRow = page.locator("#game-session-list [data-game-id]", { hasText: gameName }).first();
  const targetValue = await targetRow.getAttribute("data-game-id");
  await targetRow.click();
  await targetRow.locator("[data-open-game-id]").click();

  await expect(page).toHaveURL(new RegExp("/game/" + targetValue + "$"));
  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i);

  await page.reload();

  expect(page.url()).toContain("/game/" + targetValue);
  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i);
});
