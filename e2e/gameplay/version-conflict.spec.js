const { test, expect } = require("@playwright/test");
const { registerLoginAndJoin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("stale game tab reloads latest state after a version conflict", async ({ browser }) => {
  test.slow();

  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const currentPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("vc1");
  const secondUser = uniqueUser("vc2");

  await resetGame(currentPage);
  await currentPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(currentPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await currentPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(currentPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*3/i);

  const stalePage = await firstContext.newPage();
  await stalePage.route("**/api/events", (route) => route.abort());
  await stalePage.goto("/");

  await expect(stalePage.locator("#auth-status")).toContainText(firstUser, { timeout: 10000 });
  await expect(stalePage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*3/i);
  await expect(stalePage.getByRole("button", { name: "+1 armata" })).toBeEnabled();

  const staleVersion = await stalePage.evaluate(async () => {
    const token = localStorage.getItem("frontline-session-token");
    const response = await fetch("/api/state", {
      headers: token ? { "x-session-token": token } : {}
    });
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

  await currentPage.getByRole("button", { name: "+1 armata" }).click();
  await expect(currentPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*2/i);

  const dialogPromise = stalePage.waitForEvent("dialog");
  await stalePage.getByRole("button", { name: "+1 armata" }).click();
  const dialog = await dialogPromise;
  await expect(dialog.message()).toMatch(/aggiornata|ricaricato|recente/i);
  await dialog.accept();

  await expect(stalePage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*2/i);

  await stalePage.getByRole("button", { name: "+1 armata" }).click();
  await expect(stalePage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*1/i);

  await firstContext.close();
  await secondContext.close();
});
