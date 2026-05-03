const { test, expect } = require("@playwright/test");
const {
  getReinforcementCount,
  registerLoginAndJoin,
  resetGame,
  uniqueUser
} = require("../support/game-helpers");

test("current player can distribute reinforcements and enter attack step", async ({ browser }) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("e2e_g1");
  const secondUser = uniqueUser("e2e_g2");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(firstPage.getByTestId("phase-indicator")).not.toHaveText(/lobby/i);
  await expect.poll(async () => getReinforcementCount(firstPage)).toBeGreaterThan(0);

  const reinforceButton = firstPage.locator("#reinforce-multi-button");
  await expect(reinforceButton).toBeEnabled();

  for (;;) {
    const reinforcementCount = await getReinforcementCount(firstPage);
    if (reinforcementCount <= 0) {
      break;
    }

    await expect(reinforceButton).toBeVisible();
    await reinforceButton.click();
    await expect.poll(async () => getReinforcementCount(firstPage)).toBe(reinforcementCount - 1);
  }

  await expect.poll(async () => getReinforcementCount(firstPage)).toBe(0);
  await expect(firstPage.locator("#reinforce-group")).toBeHidden();
  await expect(firstPage.locator("#attack-group")).toBeVisible();
  await expect(firstPage.getByTestId("phase-indicator")).not.toHaveText(/lobby/i);
  await expect(firstPage.locator("#conquest-group")).toBeHidden();
  await expect(firstPage.locator("#fortify-group")).toBeHidden();
  await expect(firstPage.locator("#end-turn-button")).toHaveText("Vai a fortifica");
  await expect(firstPage.locator("#end-turn-button")).toBeEnabled();

  await firstContext.close();
  await secondContext.close();
});
