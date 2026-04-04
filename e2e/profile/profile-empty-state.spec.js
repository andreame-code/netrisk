const { test, expect } = require("@playwright/test");
const { uniqueUser } = require("../support/game-helpers");

test("profile page shows a clear empty state for an authenticated user with no history", async ({ page }) => {
  const username = uniqueUser("profile_empty");
  const password = "secret123";

  const registerResponse = await page.request.post("/api/auth/register", {
    data: { username, password }
  });
  await expect(registerResponse.ok()).toBeTruthy();

  const loginResponse = await page.request.post("/api/auth/login", {
    data: { username, password }
  });
  await expect(loginResponse.ok()).toBeTruthy();
  const sessionToken = loginResponse.headers()["set-cookie"]?.match(/netrisk_session=([^;]+)/)?.[1];
  expect(sessionToken).toBeTruthy();

  await page.context().addCookies([{
    name: "netrisk_session",
    value: sessionToken,
    url: "http://127.0.0.1:3100",
    httpOnly: true,
    sameSite: "Lax"
  }]);

  await page.goto("/profile.html");

  await expect(page.getByTestId("player-profile-shell")).toBeVisible();
  await expect(page.locator("#auth-status")).toContainText(`Autenticato come ${username}.`);
  await expect(page.locator("#profile-name")).toContainText(username);
  await expect(page.locator("#profile-heading")).toContainText(username);
  await expect(page.locator("#profile-feedback")).toBeVisible();
  await expect(page.locator("#profile-feedback")).toContainText("Nessuna statistica disponibile: completa almeno una partita per costruire il record.");
  await expect(page.locator("#profile-content")).toHaveAttribute("hidden", "");
  await expect(page.locator("#logout-button")).toBeVisible();
});
