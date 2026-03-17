const { test, expect } = require("@playwright/test");
const { registerLoginAndJoin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("non-current player stays in observation and cannot use turn actions", async ({ browser }) => {
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
  await expect(firstPage.getByText(/Distribuisci rinforzi/i)).toBeVisible();

  await expect(secondPage.getByText(/Osservazione/i)).toBeVisible({ timeout: 10000 });
  await expect(secondPage.getByRole("button", { name: "+1 armata" })).toBeDisabled();
  await expect(secondPage.getByRole("button", { name: "Lancia attacco" })).toBeDisabled();
  await expect(secondPage.locator("#fortify-button")).toBeDisabled();
  await expect(secondPage.locator("#end-turn-button")).toBeDisabled();

  await firstContext.close();
  await secondContext.close();
});
