const { test, expect } = require("@playwright/test");
const { getReinforcementCount, registerLoginAndJoin, resetGame, uniqueUser } = require("../support/game-helpers");

test("stale game tab reloads latest state after a version conflict", async ({ browser }) => {
  test.slow();

  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const currentPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("vc1");
  const secondUser = uniqueUser("vc2");

  await resetGame(currentPage);
  await currentPage.goto("/game");
  await secondPage.goto("/game");

  await registerLoginAndJoin(currentPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await currentPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(currentPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i);

  const stalePage = await firstContext.newPage();
  await stalePage.route("**/api/events", (route) => route.abort());
  await stalePage.goto("/game");

  await expect(stalePage.locator("#auth-status")).toContainText(firstUser, { timeout: 10000 });
  await expect(stalePage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i);
  await expect(stalePage.getByRole("button", { name: "Aggiungi" })).toBeEnabled();

  const staleVersion = await stalePage.evaluate(async () => {
    const response = await fetch("/api/state");
    const data = await response.json();
    return data.version;
  });

  let forceStaleVersion = true;
  await stalePage.route("**/api/action", async (route) => {
    if (!forceStaleVersion) {
      await route.continue();
      return;
    }

    forceStaleVersion = false;
    const request = route.request();
    const body = JSON.parse(request.postData() || "{}");
    body.expectedVersion = staleVersion;
    await route.continue({
      headers: {
        ...request.headers(),
        "content-type": "application/json"
      },
      postData: JSON.stringify(body)
    });
  });

  const initialReinforcements = await getReinforcementCount(currentPage);
  await currentPage.getByRole("button", { name: "Aggiungi" }).click();
  await expect.poll(() => getReinforcementCount(currentPage)).toBe(initialReinforcements - 1);

  const dialogPromise = new Promise((resolve) => {
    stalePage.once("dialog", async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      resolve(message);
    });
  });
  await stalePage.getByRole("button", { name: "Aggiungi" }).click();
  await expect(await dialogPromise).toMatch(/aggiornata|ricaricato|recente/i);

  await expect.poll(() => getReinforcementCount(stalePage)).toBe(initialReinforcements - 1);

  await stalePage.getByRole("button", { name: "Aggiungi" }).click();
  await expect.poll(() => getReinforcementCount(stalePage)).toBe(initialReinforcements - 2);

  await firstContext.close();
  await secondContext.close();
});
