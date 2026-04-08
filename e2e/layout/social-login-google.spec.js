const { test, expect } = require("@playwright/test");

test("google social login is exposed on auth entry points and can complete the callback flow", async ({ page }) => {
  let socialLoggedIn = false;
  const socialUser = {
    id: "google-user",
    username: "captain_google",
    role: "user",
    authMethods: ["google"]
  };

  await page.route("**/api/auth/providers", async (route) => {
    await route.fulfill({
      json: {
        providers: ["password", "google"],
        availableAuthProviders: ["password", "google"]
      }
    });
  });

  await page.route("**/api/auth/session", async (route) => {
    if (!socialLoggedIn) {
      await route.fulfill({
        status: 401,
        json: {
          error: "Sessione non valida."
        }
      });
      return;
    }

    await route.fulfill({
      json: {
        user: socialUser
      }
    });
  });

  await page.route("**/api/profile", async (route) => {
    await route.fulfill({
      json: {
        profile: {
          playerName: "captain_google",
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          gamesInProgress: 0,
          winRate: null,
          hasHistory: false,
          participatingGames: []
        }
      }
    });
  });

  await page.route("**/api/auth/social/google/start?*", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        provider: "google",
        authorizeUrl: "/auth-callback.html?provider=google&next=%2Fprofile.html#access_token=fake-access-token"
      }
    });
  });

  await page.route("**/api/auth/social/exchange", async (route) => {
    socialLoggedIn = true;
    await route.fulfill({
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        user: socialUser,
        nextPath: "/profile.html",
        availableAuthProviders: ["password", "google"]
      })
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    socialLoggedIn = false;
    await route.fulfill({
      json: { ok: true }
    });
  });

  await page.goto("/game.html");
  await expect(page.locator("#google-login-button")).toHaveJSProperty("hidden", false);

  await page.goto("/register.html");
  await expect(page.locator("#register-google-login-button")).toBeVisible();

  await page.locator("#register-google-login-button").click();
  await page.waitForURL("**/profile.html");
  await expect(page.locator("#profile-name")).toContainText("captain_google");
  await expect(page.locator("#auth-status")).toContainText("captain_google");

  await page.locator("#logout-button").click();
  await expect(page.locator("#header-login-button")).toBeVisible();
});
