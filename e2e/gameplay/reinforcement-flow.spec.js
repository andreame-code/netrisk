const { test, expect } = require("@playwright/test");
const { registerLoginAndJoin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("current player can distribute reinforcements and enter attack step", async ({ browser }) => {
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
  await expect(firstPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:/i);

  const reinforceButton = firstPage.getByRole("button", { name: "Aggiungi" });
  await expect(reinforceButton).toBeEnabled();

  for (;;) {
    const summaryText = await firstPage.getByTestId("status-summary").innerText();
    const match = summaryText.match(/Rinforzi disponibili:\s*(\d+)/i);
    const reinforcementCount = match ? Number(match[1]) : 0;
    if (reinforcementCount <= 0) {
      break;
    }

    await reinforceButton.click();
    await expect(firstPage.getByTestId("status-summary")).toContainText(new RegExp(String(reinforcementCount - 1)));
  }

  await expect(firstPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*0/i);
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
