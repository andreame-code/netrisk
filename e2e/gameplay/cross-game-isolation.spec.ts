const { test, expect } = require("@playwright/test");
const { getE2EBaseURL, registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

async function createAndOpenGame(page, gameName) {
  await page.goto("/lobby");
  await page.locator("#create-game-button").click();
  await expect(page).toHaveURL(/\/lobby\/new\?mode=multiplayer$/);
  await page.locator("#setup-game-name").fill(gameName);
  await page.getByRole("button", { name: "Crea e apri" }).click();
  await expect(page).toHaveURL(/\/game\//);
  await expect(page.locator("#game-status")).toContainText(gameName);
  return page.url().split("/game/")[1] || new URL(page.url()).searchParams.get("gameId");
}

test("opening another game does not switch already connected clients to a different match", async ({ browser, page }) => {
  test.slow();

  const userA = uniqueUser("iso_a");
  const userB = uniqueUser("iso_b");
  const gameA = uniqueUser("campagna_a");
  const gameB = uniqueUser("campagna_b");

  await resetGame(page);
  await page.goto("/game");
  await registerAndLogin(page, userA);
  const gameAId = await createAndOpenGame(page, gameA);

  const contextB = await browser.newContext({ baseURL: getE2EBaseURL() });
  const pageB = await contextB.newPage();

  try {
    await pageB.goto("/game");
    await registerAndLogin(pageB, userB);
    const gameBId = await createAndOpenGame(pageB, gameB);

    expect(gameBId).not.toBe(gameAId);

    await page.waitForTimeout(1500);

    await expect(page).toHaveURL(new RegExp("/game/" + gameAId + "$"));
    await expect(page.locator("#game-status")).toContainText(gameA);
    await expect(page.locator("#game-status")).not.toContainText(gameB);
    await expect(page.locator("#game-map-meta")).toBeVisible();
  } finally {
    await contextB.close();
  }
});
