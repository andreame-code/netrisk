const { test, expect } = require("@playwright/test");
const { resetGame, uniqueUser } = require("../support/game-helpers.js");

test("auth status and logout stay coherent across Game, Lobby, and Profile", async ({ page }) => {
  const username = uniqueUser("commander");
  const password = "secret123";

  await resetGame(page);
  await page.goto("/game.html");

  await page.getByPlaceholder("Utente").fill(username);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Registrati" }).click();

  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();
  await expect(page.getByPlaceholder("Utente")).toBeHidden();
  await expect(page.getByPlaceholder("Password")).toBeHidden();

  await page.goto("/lobby.html");
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();

  await page.goto("/profile.html");
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page.locator("#auth-status")).toContainText(/Sessione/i);

  await page.goto("/game.html");
  await expect(page.getByPlaceholder("Utente")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accedi" })).toBeVisible();
});
