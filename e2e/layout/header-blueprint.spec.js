const { test, expect } = require("@playwright/test");
const { resetGame, uniqueUser } = require("../support/game-helpers.js");

test("game header follows the single-row blueprint", async ({ page }) => {
  const username = uniqueUser("commander");
  const password = "secret123";

  await resetGame(page);
  await page.goto("/game.html");

  await page.locator("#auth-form #auth-username").fill(username);
  await page.locator("#auth-form #auth-password").fill(password);
  await page.getByRole("button", { name: "Registrati" }).click();

  const header = page.locator(".top-nav-bar");
  await expect(header).toBeVisible();
  await expect(header.locator(".top-nav-brand")).toBeVisible();
  await expect(header.locator(".top-nav-links")).toBeVisible();
  await expect(header.locator(".top-nav-actions")).toBeVisible();

  await expect(header.getByRole("link", { name: "Lobby" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Game" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Profile" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Esci" })).toBeVisible();
  await expect(header.locator("#nav-avatar")).toBeVisible();

  await expect(header.getByText(/Create Game/i)).toHaveCount(0);
  await expect(page.locator(".game-ops-bar")).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Entra nella lobby" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Avvia partita" })).toHaveCount(0);

  await expect(page.getByTestId("info-panel")).toContainText(/Player/i);
  await expect(page.getByTestId("info-panel")).toContainText(/Active game/i);
});
