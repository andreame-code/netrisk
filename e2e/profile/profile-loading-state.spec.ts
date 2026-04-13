const { test, expect } = require("@playwright/test");
const { attachSessionCookie, uniqueUser } = require("../support/game-helpers");

test("profile page shows a loading state while the profile payload is still pending", async ({ page }) => {
  const username = uniqueUser("profile_loading");
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

  let releaseProfileResponse;
  const profileResponseReleased = new Promise((resolve) => {
    releaseProfileResponse = resolve;
  });

  await page.route("**/api/profile", async (route) => {
    await profileResponseReleased;
    const response = await route.fetch();
    await route.fulfill({ response });
  });

  const navigation = page.goto("/profile.html");

  await expect(page.getByTestId("player-profile-shell")).toBeVisible();
  await expect(page.locator("#profile-feedback")).toContainText("Caricamento dati giocatore...");
  await expect(page.locator("#profile-content")).toHaveAttribute("hidden", "");

  releaseProfileResponse();
  await navigation;

  await expect(page.locator("#auth-status")).toContainText(`Autenticato come ${username}.`);
  await expect(page.locator("#profile-name")).toContainText(username);
});
