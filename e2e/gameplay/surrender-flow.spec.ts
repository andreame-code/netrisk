const { test, expect } = require("@playwright/test");
const { registerLoginAndJoin, resetGame, uniqueUser } = require("../support/game-helpers");

test("surrender keeps territories owned by the surrendered player and awards victory to the last active player", async ({ browser }) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("sur_a");
  const secondUser = uniqueUser("sur_b");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(firstPage.locator("#surrender-button")).toBeVisible({ timeout: 10000 });

  const firstPlayerCard = firstPage.locator("#players .player-card").filter({ hasText: firstUser });
  const territoriesBeforeText = await firstPlayerCard.innerText();
  const territoriesBeforeMatch = territoriesBeforeText.match(/Territori:\s*(\d+)/i);
  expect(territoriesBeforeMatch).not.toBeNull();
  const territoriesBefore = Number(territoriesBeforeMatch[1]);
  expect(territoriesBefore).toBeGreaterThan(0);

  firstPage.once("dialog", (dialog) => dialog.accept());
  await firstPage.locator("#surrender-button").click();

  await expect(firstPage.getByTestId("status-summary")).toContainText(new RegExp(`Vincitore:\\s*${secondUser}`, "i"), { timeout: 15000 });
  await expect(secondPage.getByTestId("status-summary")).toContainText(new RegExp(`Vincitore:\\s*${secondUser}`, "i"), { timeout: 15000 });

  const surrenderedCardFirstPage = firstPage.locator("#players .player-card").filter({ hasText: firstUser });
  await expect(surrenderedCardFirstPage).toContainText(/Stato:\s*eliminato/i);
  await expect(surrenderedCardFirstPage).toContainText(new RegExp(`Territori:\\s*${territoriesBefore}`));

  const surrenderedCardSecondPage = secondPage.locator("#players .player-card").filter({ hasText: firstUser });
  await expect(surrenderedCardSecondPage).toContainText(/Stato:\s*eliminato/i);
  await expect(surrenderedCardSecondPage).toContainText(new RegExp(`Territori:\\s*${territoriesBefore}`));

  await expect(firstPage.locator("#surrender-button")).toBeHidden();
  await expect(firstPage.locator("#end-turn-button")).toBeHidden();

  await firstContext.close();
  await secondContext.close();
});

