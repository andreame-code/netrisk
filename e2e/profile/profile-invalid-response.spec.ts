const { test, expect } = require("@playwright/test");
const { attachSessionCookie, uniqueUser } = require("../support/game-helpers");

test("profile page shows controlled feedback when the profile payload shape is invalid", async ({ page }) => {
  const username = uniqueUser("profile_invalid");
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
  await attachSessionCookie(page, sessionToken);

  await page.route("**/api/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          playerName: 42
        }
      })
    });
  });

  await page.goto("/profile.html");

  await expect(page.getByTestId("player-profile-shell")).toBeVisible();
  await expect(page.locator("#auth-status")).toContainText(username);
  await expect(page.locator("#profile-feedback")).toBeVisible();
  await expect(page.locator("#profile-feedback")).toContainText("Impossibile caricare il profilo.");
  await expect(page.locator("#profile-content")).toHaveAttribute("hidden", "");
});
