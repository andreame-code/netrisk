const { test, expect } = require("@playwright/test");

const { resetGame, uniqueUser } = require("../support/game-helpers");

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

test("react shell bootstrap redirects guests to the login route", async ({ page }) => {
  await resetGame(page);

  await page.route("**/api/auth/session", async (route) => {
    await delay(150);
    await route.continue();
  });

  await page.goto("/react/");

  await expect(page).toHaveTitle(/NetRisk React Shell/i);
  await expect(page.getByTestId("react-shell-loading")).toBeVisible();
  await expect(page).toHaveURL(/\/react\/login$/);
  await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
  await expect(page.getByTestId("react-shell-session-status")).toContainText(/Guest/i);
});

test("protected react routes redirect guests and preserve the requested destination", async ({ page }) => {
  await resetGame(page);

  await page.goto("/react/profile");

  await expect(page).toHaveURL(/\/react\/login\?next=%2Fprofile$/);
  await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
});

test("authenticated sessions can open a protected react route directly", async ({ page }) => {
  await resetGame(page);

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("react_shell_profile"));
  await page.context().addCookies([{
    name: "netrisk_session",
    value: sessionToken,
    url: "http://127.0.0.1:3100",
    httpOnly: true,
    sameSite: "Lax"
  }]);

  await page.goto("/react/profile");

  await expect(page).toHaveURL(/\/react\/profile$/);
  await expect(page.getByTestId("react-shell-profile-page")).toBeVisible();
  await expect(page.getByTestId("react-shell-session-status")).toContainText(/Authenticated/i);
});

test("react login returns the user to the protected route that triggered it", async ({ page }) => {
  await resetGame(page);

  const username = uniqueUser("react_shell_login");
  const password = "secret123";
  const registerResponse = await page.request.post("/api/auth/register", {
    data: { username, password }
  });
  await expect(registerResponse.ok()).toBeTruthy();

  await page.goto("/react/game/game-99");
  await expect(page).toHaveURL(/\/react\/login\?next=%2Fgame%2Fgame-99$/);

  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/react\/game\/game-99$/);
  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(page.getByText("Selected game id: game-99")).toBeVisible();
});

test("react shell serves direct unknown routes into the SPA not-found page", async ({ page }) => {
  await resetGame(page);

  await page.goto("/react/does-not-exist");

  await expect(page).toHaveURL(/\/react\/does-not-exist$/);
  await expect(page.getByTestId("react-shell-not-found")).toBeVisible();
});
