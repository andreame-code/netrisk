const { test, expect } = require("@playwright/test");
const {
  getReinforcementCount,
  registerLoginAndJoin,
  resetGame,
  uniqueUser
} = require("../support/game-helpers.js");

test("human player can end turn and watch the AI complete its turn automatically", async ({ page }) => {
  test.slow();

  const humanUser = uniqueUser("ai_e2e");
  const aiName = "CPU Basic";

  await resetGame(page);
  await page.goto("/");

  await registerLoginAndJoin(page, humanUser);

  const joinAiResponse = await page.request.post("/api/ai/join", {
    data: { name: aiName }
  });
  await expect(joinAiResponse.ok()).toBeTruthy();

  await page.getByRole("button", { name: "Avvia partita" }).click();
  await expect(page.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*3/i);

  const reinforceButton = page.getByRole("button", { name: "+1 armata" });
  let reinforcementCount = await getReinforcementCount(page);
  while (reinforcementCount > 0) {
    await reinforceButton.click();
    await expect.poll(() => getReinforcementCount(page), {
      message: "i rinforzi disponibili devono diminuire dopo ogni click"
    }).toBeLessThan(reinforcementCount);
    reinforcementCount = await getReinforcementCount(page);
  }

  await expect(page.locator("#end-turn-button")).toBeEnabled();
  await expect(page.locator("#end-turn-button")).toHaveText("Vai a fortifica");

  await page.locator("#end-turn-button").click();
  await expect(page.locator("#fortify-group")).toBeVisible();
  await expect(page.locator("#end-turn-button")).toHaveText("Termina turno");

  await page.locator("#end-turn-button").click();

  await expect(page.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i, { timeout: 10000 });
  await expect(page.getByRole("button", { name: "+1 armata" })).toBeEnabled();
  await expect(page.locator("#players")).toContainText(aiName);
  await expect(page.locator("#log")).toContainText(aiName);
});
