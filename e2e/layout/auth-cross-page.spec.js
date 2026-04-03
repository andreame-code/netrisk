const { test, expect } = require("@playwright/test");
const { resetGame, uniqueUser } = require("../support/game-helpers.js");

test("auth status and logout stay coherent across Game, Lobby, and Profile", async ({ page }) => {
  test.slow();
  const username = uniqueUser("commander");
  const password = "secret123";

  await resetGame(page);
  await page.goto("/game.html");

  await page.locator("#auth-username").fill(username);
  await page.locator("#auth-password").fill(password);
  await page.getByRole("button", { name: "Registrati" }).click();

  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();
  await expect(page.locator("#header-auth-username")).toBeHidden();
  await expect(page.locator("#header-auth-password")).toBeHidden();

  await page.goto("/lobby.html");
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();

  await page.goto("/profile.html");
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();

  await page.goto("/lobby.html");
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page.locator("#auth-status")).toContainText(/Sessione|Accedi/i);

  await page.goto("/game.html");
  await expect(page.locator("#header-auth-username")).toBeVisible();
  await expect(page.locator("#header-auth-password")).toBeVisible();
  await expect(page.locator("#header-login-button")).toBeVisible();
});
