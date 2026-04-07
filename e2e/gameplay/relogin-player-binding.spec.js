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
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.locator("#setup-game-name").fill(gameName);
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-status")).toContainText(gameName, { timeout: 15000 });
  await expect(page.locator("#identity-status")).toContainText(username, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Entra nella lobby" })).toBeDisabled({ timeout: 15000 });
  const joinAiResponse = await page.request.post("/api/ai/join", {
    data: { name: "CPU Rebind" }
  });
  await expect(joinAiResponse.ok()).toBeTruthy();

  await page.getByRole("button", { name: "Avvia partita" }).click();
  await expect(page.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i);
  await expect(page.getByRole("button", { name: "Aggiungi" })).toBeEnabled();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page.locator("#header-auth-username")).toBeVisible();

  await page.locator("#header-auth-username").fill(username);
  await page.locator("#header-auth-password").fill("secret123");
  await page.locator("#header-login-button").click();
  await expect(page.locator("#auth-status")).toContainText(username);

  await page.goto("/lobby.html");
  const targetRow = page.locator("#game-session-list [data-game-id]", { hasText: gameName }).first();
  await expect(targetRow).toBeVisible();
  await targetRow.click();
  await page.getByRole("button", { name: "Apri selezionata" }).click();

  await expect(page.locator("#identity-status")).toContainText(username, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Aggiungi" })).toBeEnabled({ timeout: 15000 });
  await page.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i);
});

