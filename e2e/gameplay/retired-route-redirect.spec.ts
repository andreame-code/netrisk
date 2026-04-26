const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("retired legacy document links redirect into the canonical React game route", async ({
  page
}) => {
  test.slow();
  const ownerUser = uniqueUser("retired_route_owner");
  const gameName = uniqueUser("retired_route_game");

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
  const retiredDocumentUrl = `/legacy/game.html?gameId=${encodeURIComponent(gameId)}`;

  const redirectResponse = await page.goto(retiredDocumentUrl);
  expect(redirectResponse).toBeTruthy();
  expect(redirectResponse.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/game/${encodeURIComponent(gameId)}$`));
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.locator("#game-status")).toContainText(gameName);
});
