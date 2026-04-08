const { test, expect } = require("@playwright/test");
const { registerLoginAndJoin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("non-current player stays in observation and cannot use turn actions", async ({ browser }) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("e2e_g7");
  const secondUser = uniqueUser("e2e_g8");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(firstPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i);

  await expect(secondPage.locator("#identity-status")).toContainText(secondUser, { timeout: 15000 });
  await expect(secondPage.locator("#reinforce-group")).toBeHidden();
  await expect(secondPage.locator("#attack-group")).toBeHidden();
  await expect(secondPage.locator("#fortify-group")).toBeHidden();
  await expect(secondPage.locator("#conquest-group")).toBeHidden();
  await expect(secondPage.locator("#end-turn-button")).toBeHidden();

  await firstContext.close();
  await secondContext.close();
});
