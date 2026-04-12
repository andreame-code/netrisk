const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("auth status and logout stay coherent across Game, Lobby, and Profile", async ({ page }) => {
  test.slow();
  const username = uniqueUser("commander");

  await resetGame(page);
  await registerAndLogin(page, username);

  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.locator("#logout-button")).toBeVisible();
  await expect(page.locator("#header-auth-username")).toBeHidden();
  await expect(page.locator("#header-auth-password")).toBeHidden();

  await page.goto("/lobby.html");
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.locator("#logout-button")).toBeVisible();

  await page.goto("/profile.html");
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.locator("#logout-button")).toBeVisible();

  await page.goto("/lobby.html");
  await page.locator("#logout-button").click();
  await expect(page.locator("#auth-status")).toContainText(/session|accedi|log in/i);

  await page.goto("/game.html");
  await expect(page.locator("#header-auth-username")).toBeVisible();
  await expect(page.locator("#header-auth-password")).toBeVisible();
  await expect(page.locator("#header-login-button")).toBeVisible();
});

