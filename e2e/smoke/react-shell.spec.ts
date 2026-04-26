const { test, expect } = require("@playwright/test");

const { attachSessionCookie, resetGame, uniqueUser } = require("../support/game-helpers");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createAuthenticatedSession(page, username, password = "secret123") {
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

  return sessionToken;
}

test("react shell bootstrap keeps guests on the canonical landing route", async ({ page }) => {
  await resetGame(page);

  await page.route("**/api/auth/session", async (route) => {
    await delay(150);
    await route.continue();
  });

  await page.goto("/react/");

  await expect(page).toHaveTitle(/Frontline Dominion/i);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".ld-header")).toBeVisible();
  await expect(page.getByRole("link", { name: "Accedi" })).toBeVisible();
});

test("react profile keeps guest access inline and preserves the requested destination", async ({ page }) => {
  await resetGame(page);

  await page.goto("/react/profile?tab=stats");

  await expect(page).toHaveURL(/\/react\/profile\?tab=stats$/);
  await expect(page.getByTestId("react-shell-profile-page")).toBeVisible();
  await expect(page.getByTestId("react-shell-session-status")).toContainText(/guest/i);
  await expect(page.locator("#profile-feedback")).toContainText(
    /Accedi prima di consultare il profilo giocatore|Log in before opening the player profile/i
  );
  await expect(page.locator("#profile-content")).toHaveAttribute("hidden", "");
});

test("authenticated sessions can open a protected react route directly", async ({ page }) => {
  await resetGame(page);

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("react_shell_profile"));
  await attachSessionCookie(page, sessionToken);

  await page.goto("/react/profile");

  await expect(page).toHaveURL(/\/react\/profile$/);
  await expect(page.getByTestId("react-shell-profile-page")).toBeVisible();
  await expect(page.getByTestId("react-shell-session-status")).toContainText(/Authenticated/i);
});

test("react profile shows query loading before resolving into the empty-history state", async ({ page }) => {
  await resetGame(page);

  const username = uniqueUser("rsh_prof_load");
  const sessionToken = await createAuthenticatedSession(page, username);
  await attachSessionCookie(page, sessionToken);

  let releaseProfileResponse;
  const profileResponseReleased = new Promise((resolve) => {
    releaseProfileResponse = resolve;
  });

  await page.route("**/api/profile", async (route) => {
    await profileResponseReleased;
    await route.continue();
  });

  const navigation = page.goto("/react/profile");
  await expect(page.getByTestId("react-shell-profile-loading")).toBeVisible();
  releaseProfileResponse();
  await navigation;

  await expect(page.locator("#profile-name")).toContainText(username);
  await expect(page.getByTestId("react-shell-profile-empty")).toBeVisible();
  await expect(page.getByTestId("react-shell-profile-theme-select")).toHaveValue("command");
});

test("react profile shows the empty-history state for a new authenticated user", async ({ page }) => {
  await resetGame(page);

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("rsh_prof_empty"));
  await attachSessionCookie(page, sessionToken);

  await page.goto("/react/profile");

  await expect(page.getByTestId("react-shell-profile-page")).toBeVisible();
  await expect(page.locator("#profile-content")).toHaveAttribute("hidden", "");
  await expect(page.getByTestId("react-shell-profile-empty")).toBeVisible();
  await expect(page.getByTestId("react-shell-profile-empty")).toContainText(
    /No stats available|Nessuna statistica disponibile/
  );
});

test("react profile theme mutation keeps shell theme coherent across navigation", async ({ page }) => {
  await resetGame(page);

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("rsh_theme"));
  await attachSessionCookie(page, sessionToken);

  await page.goto("/react/profile");

  const themeSelect = page.getByTestId("react-shell-profile-theme-select");
  await expect(themeSelect).toHaveValue("command");

  await themeSelect.selectOption("midnight");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
  await expect(themeSelect).toHaveValue("midnight");
  await expect(page.getByTestId("react-shell-profile-theme-status")).toContainText(
    /Theme applied|Tema applicato|Midnight|Mezzanotte/
  );
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("netrisk.theme"))).toBe(
    "midnight"
  );

  await page.goto("/react/lobby");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");

  await page.goto("/react/profile");
  await expect(page.getByTestId("react-shell-profile-theme-select")).toHaveValue("midnight");
});

test("react profile shows controlled feedback when the query payload is invalid", async ({ page }) => {
  await resetGame(page);

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("rsh_prof_bad"));
  await attachSessionCookie(page, sessionToken);

  await page.route("**/api/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          playerName: 99
        }
      })
    });
  });

  await page.goto("/react/profile");

  await expect(page.getByTestId("react-shell-profile-error")).toBeVisible();
  await expect(page.getByTestId("react-shell-profile-error")).toContainText(
    /Unable to load the profile|Impossibile caricare il profilo/
  );
});

test("react profile participating games open the React gameplay route", async ({ page }) => {
  await resetGame(page);

  const username = uniqueUser("rsh_prof_game");
  const sessionToken = await createAuthenticatedSession(page, username);
  const gameName = `React profile ${Date.now().toString(36).slice(-4)}`;

  const createGameResponse = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` },
    data: {
      name: gameName,
      mapId: "world-classic",
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "ai" }
      ]
    }
  });
  await expect(createGameResponse.ok()).toBeTruthy();
  const createdGame = await createGameResponse.json();

  await attachSessionCookie(page, sessionToken);
  await page.goto("/react/profile");

  const openLink = page.getByTestId(`react-shell-profile-open-${createdGame.game.id}`);
  await expect(openLink).toBeVisible();
  await expect(openLink).toHaveAttribute("href", new RegExp(`/react/game/${createdGame.game.id}$`));
  await expect(openLink).toContainText(gameName);

  await openLink.click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(
    new RegExp(`/react/game/${createdGame.game.id}$`)
  );
  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.locator("#players")).toContainText(username, { timeout: 15000 });
});

test("react profile restores the previous theme when the mutation fails", async ({ page }) => {
  await resetGame(page);

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("rsh_theme_err"));
  await attachSessionCookie(page, sessionToken);

  await page.route("**/api/profile/preferences/theme", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Theme update failed."
      })
    });
  });

  await page.goto("/react/profile");

  const themeSelect = page.getByTestId("react-shell-profile-theme-select");
  await expect(themeSelect).toHaveValue("command");

  await themeSelect.selectOption("ember");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "command");
  await expect(themeSelect).toHaveValue("command");
  await expect(page.getByTestId("react-shell-profile-theme-status")).toContainText(
    /Save failed|Salvataggio non riuscito|Theme update failed|Richiesta fallita/
  );
});

test("react login returns the user to the requested gameplay route", async ({ page }) => {
  await resetGame(page);

  const username = uniqueUser("react_shell_login");
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

  const createGameResponse = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` },
    data: {
      name: `React login ${Date.now().toString(36).slice(-4)}`,
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "ai" }
      ]
    }
  });
  await expect(createGameResponse.ok()).toBeTruthy();
  const createdGame = await createGameResponse.json();

  await page.context().clearCookies();

  await page.goto(`/react/login?next=%2Fgame%2F${createdGame.game.id}`);
  await expect(page).toHaveURL(new RegExp(`/react/login\\?next=%2Fgame%2F${createdGame.game.id}$`));

  const loginPage = page.getByTestId("react-shell-login-page");
  await loginPage.getByLabel("Username").fill(username);
  await loginPage.getByLabel("Password").fill(password);
  await loginPage.getByRole("button", { name: /Sign in|Accedi/i }).click();

  await expect(page).toHaveURL(new RegExp(`/react/game/${createdGame.game.id}$`));
  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
});

test("react register creates an account and enters the requested protected route", async ({
  page
}) => {
  await resetGame(page);

  const username = uniqueUser("react_shell_register");

  await page.goto("/react/register?next=%2Fprofile");

  const registerPage = page.getByTestId("react-shell-register-page");
  await registerPage.getByLabel(/Username/i).fill(username);
  await registerPage.getByLabel(/^Password$/i).fill("secret123");
  await registerPage.getByLabel(/Confirm password|Conferma password/i).fill("secret123");
  await registerPage.getByRole("button", { name: /Register|Registrati/i }).click();

  await expect(page).toHaveURL(/\/react\/profile$/);
  await expect(page.getByTestId("react-shell-profile-page")).toBeVisible();
  await expect(page.getByTestId("react-shell-session-status")).toContainText(/Authenticated/i);
});

test("react shell serves direct unknown routes into the SPA not-found page", async ({ page }) => {
  await resetGame(page);

  await page.goto("/react/does-not-exist");

  await expect(page).toHaveURL(/\/react\/does-not-exist$/);
  await expect(page.getByTestId("react-shell-not-found")).toBeVisible();
});
