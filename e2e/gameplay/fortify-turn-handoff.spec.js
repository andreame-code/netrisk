const { test, expect } = require("@playwright/test");
const {
  findAttackPair,
  getReinforcementCount,
  queueNextAttackRolls,
  registerLoginAndJoin,
  resetGame,
  uniqueUser
} = require("../support/game-helpers.js");

test("current player can fortify once and pass the turn to the next player", async ({ browser }) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("e2e_g5");
  const secondUser = uniqueUser("e2e_g6");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(firstPage.getByTestId("phase-indicator")).not.toHaveText(/lobby/i);

  const attackPair = await findAttackPair(firstPage, firstUser);
  const reinforcementCount = await getReinforcementCount(firstPage);
  const reinforceButton = firstPage.getByRole("button", { name: "Aggiungi" });

  for (let index = 0; index < reinforcementCount; index += 1) {
    await reinforceButton.click();
  }

  await firstPage.locator("#attack-from").selectOption(attackPair.fromId);
  await firstPage.locator("#attack-to").selectOption(attackPair.toId);
  await firstPage.locator("#attack-dice").selectOption("1");
  await queueNextAttackRolls(firstPage, 6, 1);
  await firstPage.getByRole("button", { name: "Lancia attacco" }).click();
  await expect(firstPage.locator("#conquest-group")).toBeVisible();
  await firstPage.locator("#conquest-armies").fill("1");
  await firstPage.getByRole("button", { name: "Sposta armate" }).click();

  await firstPage.locator("#end-turn-button").click();
  await expect(firstPage.locator("#fortify-group")).toBeVisible();
  await expect(firstPage.locator("#fortify-button")).toBeEnabled();
  await expect(firstPage.locator("#end-turn-button")).toHaveText("Termina turno");
  await expect(firstPage.locator("#end-turn-button")).toBeEnabled();

  await firstPage.locator("#fortify-from").selectOption(attackPair.fromId);
  await firstPage.locator("#fortify-to").selectOption(attackPair.toId);
  await firstPage.locator("#fortify-armies").fill("1");
  await firstPage.locator("#fortify-button").click();

  await expect(firstPage.locator("#fortify-button")).toBeDisabled();
  await expect(firstPage.locator("#end-turn-button")).toBeEnabled();
  await expect(firstPage.locator('[data-territory-id="' + attackPair.toId + '"] .territory-armies')).toHaveText("2");

  await firstPage.locator("#end-turn-button").click();

  await expect(secondPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i, { timeout: 10000 });
  await expect(secondPage.getByRole("button", { name: "Aggiungi" })).toBeEnabled();
  await expect(firstPage.locator("#reinforce-group")).toBeHidden({ timeout: 10000 });
  await expect(firstPage.locator("#attack-group")).toBeHidden();
  await expect(firstPage.locator("#fortify-group")).toBeHidden();
  await expect(firstPage.locator("#end-turn-button")).toBeHidden();

  await firstContext.close();
  await secondContext.close();
});

