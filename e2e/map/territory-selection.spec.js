const { test, expect } = require("@playwright/test");
const { registerLoginAndJoin, uniqueUser } = require("../support/game-helpers.js");

test("territory selection updates action controls for the current player", async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("e2e_a");
  const secondUser = uniqueUser("e2e_b");

  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(firstPage.getByTestId("phase-indicator")).not.toHaveText(/lobby/i);

  const myTerritory = firstPage.locator('[data-territory-id]').filter({ hasText: firstUser }).first();
  await expect(myTerritory).toBeVisible();

  const territoryId = await myTerritory.getAttribute("data-territory-id");
  await myTerritory.click();

  await expect(firstPage.locator("#reinforce-select")).toHaveValue(territoryId || "");
  await expect(firstPage.locator("#attack-from")).toHaveValue(territoryId || "");

  await firstContext.close();
  await secondContext.close();
});
