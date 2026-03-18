const { test, expect } = require("@playwright/test");
const { resetGame, uniqueUser } = require("../support/game-helpers.js");

test("lobby and profile headers follow the shared single-row blueprint", async ({ page }) => {
  const username = uniqueUser("commander");
  const password = "secret123";

  await resetGame(page);
  await page.goto("/game.html");
  await page.getByPlaceholder("Utente").fill(username);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Registrati" }).click();
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();

  await page.goto("/lobby.html");
  const lobbyHeader = page.locator(".top-nav-bar");
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(lobbyHeader).toBeVisible();
  await expect(lobbyHeader.locator(".top-nav-brand")).toBeVisible();
  await expect(lobbyHeader.locator(".top-nav-links")).toBeVisible();
  await expect(lobbyHeader.locator(".top-nav-actions")).toBeVisible();
  await expect(lobbyHeader.getByRole("link", { name: "Lobby" })).toBeVisible();
  await expect(lobbyHeader.getByRole("link", { name: "Game" })).toBeVisible();
  await expect(lobbyHeader.getByRole("link", { name: "Profile" })).toBeVisible();
  await expect(lobbyHeader.getByRole("button", { name: "Esci" })).toBeVisible();
  await expect(lobbyHeader.locator("#nav-avatar")).toBeVisible();
  await expect(lobbyHeader.getByText(/Create Game|Crea partita/i)).toHaveCount(0);
  await expect(page.locator("#create-game-button")).toBeVisible();
  await expect(page.locator("#open-game-button")).toBeVisible();
  await expect(page.locator(".content-meta-line.lobby-meta-line")).toBeVisible();

  await page.goto("/profile.html");
  const profileHeader = page.locator(".top-nav-bar");
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(profileHeader).toBeVisible();
  await expect(profileHeader.locator(".top-nav-brand")).toBeVisible();
  await expect(profileHeader.locator(".top-nav-links")).toBeVisible();
  await expect(profileHeader.locator(".top-nav-actions")).toBeVisible();
  await expect(profileHeader.getByRole("link", { name: "Lobby" })).toBeVisible();
  await expect(profileHeader.getByRole("link", { name: "Game" })).toBeVisible();
  await expect(profileHeader.getByRole("link", { name: "Profile" })).toBeVisible();
  await expect(profileHeader.getByRole("button", { name: "Esci" })).toBeVisible();
  await expect(profileHeader.locator("#nav-avatar")).toBeVisible();
  await expect(profileHeader.getByText(/Create Game|Crea partita/i)).toHaveCount(0);
  await expect(page.locator(".content-meta-line.profile-meta-line")).toBeVisible();
});
