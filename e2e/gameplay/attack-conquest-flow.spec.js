const { test, expect } = require("@playwright/test");
const {
  findAttackPair,
  getReinforcementCount,
  queueNextAttackRolls,
  registerLoginAndJoin,
  resetGame,
  uniqueUser
} = require("../support/game-helpers.js");

test("current player can conquer a territory and move armies after combat", async ({ browser }) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("e2e_g3");
  const secondUser = uniqueUser("e2e_g4");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(firstPage.getByTestId("phase-indicator")).not.toHaveText(/lobby/i);

  const attackPair = await findAttackPair(firstPage, firstUser);
  const reinforcementCount = await getReinforcementCount(firstPage);
  const reinforceButton = firstPage.getByRole("button", { name: "+1 armata" });

  for (let index = 0; index < reinforcementCount; index += 1) {
    await reinforceButton.click();
  }

  await expect(firstPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*0/i);
  await firstPage.locator("#attack-from").selectOption(attackPair.fromId);
  await firstPage.locator("#attack-to").selectOption(attackPair.toId);
  await firstPage.locator("#attack-dice").selectOption("1");

  await queueNextAttackRolls(firstPage, 6, 1);
  await firstPage.getByRole("button", { name: "Lancia attacco" }).click();

  await expect(firstPage.locator("#conquest-group")).toBeVisible();
  await expect(firstPage.locator("#end-turn-button")).toBeDisabled();

  await firstPage.locator("#conquest-armies").fill("1");
  await firstPage.getByRole("button", { name: "Sposta armate" }).click();

  await expect(firstPage.locator("#conquest-group")).toBeHidden();
  await expect(firstPage.locator("#fortify-group")).toBeHidden();
  await expect(firstPage.locator("#end-turn-button")).toHaveText("Vai a fortifica");
  await expect(firstPage.locator("#end-turn-button")).toBeEnabled();
  await expect(firstPage.locator('[data-territory-id="' + attackPair.toId + '"]')).toContainText(firstUser);
  await expect(firstPage.locator('[data-territory-id="' + attackPair.toId + '"] .territory-armies')).toHaveText("1");

  await firstContext.close();
  await secondContext.close();
});
