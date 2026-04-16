const { test, expect } = require("@playwright/test");
const { getReinforcementCount, registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("direct game route keeps reinforcement controls working after refresh", async ({ page }) => {
  test.slow();

  const username = uniqueUser("route_refresh");
  const gameName = uniqueUser("campagna_refresh");

  await resetGame(page);
  await page.goto("/game.html");
  await registerAndLogin(page, username);

  await page.goto("/new-game.html");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-game-name").fill(gameName);
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-status")).toContainText(gameName, { timeout: 15000 });
  const joinAiResponse = await page.request.post("/api/ai/join", {
    data: { name: "CPU Refresh" }
  });
  await expect(joinAiResponse.ok()).toBeTruthy();

  await page.getByRole("button", { name: "Avvia partita" }).click();
  await expect(page.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i);

  const directGameUrl = page.url();
  await page.goto(directGameUrl);
  await page.reload();

  await expect(page.locator("#identity-status")).toContainText(username, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Aggiungi" })).toBeEnabled({ timeout: 15000 });

  const beforeReinforcementCount = await getReinforcementCount(page);
  await page.getByRole("button", { name: "Aggiungi" }).click();
  await expect.poll(async () => getReinforcementCount(page)).toBe(Math.max(0, beforeReinforcementCount - 1));
});
