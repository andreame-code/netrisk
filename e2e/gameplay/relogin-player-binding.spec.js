const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

test("existing game keeps the same player binding after logout and login again", async ({ page }) => {
  test.slow();

  const username = uniqueUser("rebind_e2e");
  const gameName = uniqueUser("campagna_rebind");

  await resetGame(page);
  await page.goto("/game.html");
  await registerAndLogin(page, username);

  await page.goto("/lobby.html");
  await page.locator("#create-game-button").click();
  await expect(page).toHaveURL(/\/new-game\.html$/);
  await page.locator("#setup-game-name").fill(gameName);
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#join-button")).toBeDisabled();
  await expect(page.locator("#identity-status")).toContainText(username);
  const joinAiResponse = await page.request.post("/api/ai/join", {
    data: { name: "CPU Rebind" }
  });
  await expect(joinAiResponse.ok()).toBeTruthy();

  await page.getByRole("button", { name: "Avvia partita" }).click();
  await expect(page.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*3/i);
  await expect(page.getByRole("button", { name: "+1 armata" })).toBeEnabled();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page.locator("#auth-form #auth-username")).toBeVisible();

  await page.locator("#auth-form #auth-username").fill(username);
  await page.locator("#auth-form #auth-password").fill("secret123");
  await page.locator("#auth-form #login-button").click();
  await expect(page.locator("#auth-status")).toContainText(username);

  await page.goto("/lobby.html");
  const targetRow = page.locator("#game-session-list [data-game-id]", { hasText: gameName }).first();
  await expect(targetRow).toBeVisible();
  await targetRow.click();
  await page.getByRole("button", { name: "Apri selezionata" }).click();

  await expect(page.locator("#identity-status")).toContainText(username);
  await expect(page.getByRole("button", { name: "+1 armata" })).toBeEnabled();
  await page.getByRole("button", { name: "+1 armata" }).click();
  await expect(page.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*2/i);
});

