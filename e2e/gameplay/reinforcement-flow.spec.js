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

  const reinforceButton = firstPage.getByRole("button", { name: "+1 armata" });
  await expect(reinforceButton).toBeEnabled();

  const summaryText = await firstPage.getByTestId("status-summary").innerText();
  const match = summaryText.match(/Rinforzi disponibili:\s*(\d+)/i);
  const reinforcementCount = match ? Number(match[1]) : 0;

  for (let index = 0; index < reinforcementCount; index += 1) {
    await reinforceButton.click();
  }

  await expect(firstPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*0/i);
  await expect(reinforceButton).toBeDisabled();
  await expect(firstPage.getByText(/Puoi attaccare o passare alla fortifica/i)).toBeVisible();
  await expect(firstPage.getByRole("button", { name: "Vai a fortifica" })).toBeEnabled();

  await firstContext.close();
  await secondContext.close();
});
