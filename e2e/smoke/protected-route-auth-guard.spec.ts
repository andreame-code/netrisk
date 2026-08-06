const { test, expect } = require("@playwright/test");

const { getE2EBaseURL, resetGame, uniqueUser } = require("../support/game-helpers");

const protectedRoutes = [
  {
    requestedPath: "/profile",
    loginPath: "/login",
    nextPath: "/profile"
  },
  {
    requestedPath: "/react/profile?tab=stats",
    loginPath: "/react/login",
    nextPath: "/profile?tab=stats"
  },
  {
    requestedPath: "/react/profile/?tab=stats",
    loginPath: "/react/login",
    nextPath: "/profile/?tab=stats"
  },
  {
    requestedPath: "/lobby/new",
    loginPath: "/login",
    nextPath: "/lobby/new"
  },
  {
    requestedPath: "/react/lobby/new?map=world-classic",
    loginPath: "/react/login",
    nextPath: "/lobby/new?map=world-classic"
  },
  {
    requestedPath: "/react/lobby/new/?map=world-classic",
    loginPath: "/react/login",
    nextPath: "/lobby/new/?map=world-classic"
  }
];

test.describe("protected mobile route authentication guard", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("redirects anonymous canonical and React-alias routes before protected requests", async ({
    page
  }) => {
    await resetGame(page);
    const protectedRequests = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/api/profile" || pathname === "/api/game/options") {
        protectedRequests.push(pathname);
      }
    });

    for (const route of protectedRoutes) {
      await page.goto(route.requestedPath);

      await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
      const currentUrl = new URL(page.url());
      expect(currentUrl.pathname).toBe(route.loginPath);
      expect(currentUrl.searchParams.get("next")).toBe(route.nextPath);
      await expect(page.getByTestId("player-profile-shell")).toHaveCount(0);
      await expect(page.getByTestId("new-game-shell")).toHaveCount(0);
    }

    expect(protectedRequests).toEqual([]);
  });

  test("preserves locale and exact query parameters through login", async ({ page }) => {
    await resetGame(page);
    const username = uniqueUser("protected_return");
    const password = "secret123";
    const registerResponse = await page.request.post("/api/auth/register", {
      data: { username, password }
    });
    await expect(registerResponse.ok()).toBeTruthy();
    await page.context().clearCookies();

    await page.goto("/react/profile/?lang=en&tab=stats");

    await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
    let currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/react/login");
    expect(currentUrl.searchParams.get("next")).toBe("/profile/?lang=en&tab=stats");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Log in to command" })).toBeVisible();

    const loginPage = page.getByTestId("react-shell-login-page");
    await loginPage.locator('input[name="username"]').fill(username);
    await loginPage.locator('input[name="password"]').fill(password);
    await loginPage.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByTestId("player-profile-shell")).toBeVisible();
    currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/react/profile/");
    expect(currentUrl.search).toBe("?lang=en&tab=stats");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("reports and clears an expired session before redirecting to login", async ({ page }) => {
    await resetGame(page);
    await page.context().addCookies([
      {
        name: "netrisk_session",
        value: "expired-e2e-session",
        url: getE2EBaseURL(),
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);
    const protectedRequests = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/game/options") {
        protectedRequests.push(request.url());
      }
    });

    await page.goto("/react/lobby/new");

    await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
    await expect(page.getByTestId("react-shell-session-expired")).toContainText(
      /Sessione scaduta|Session expired/i
    );
    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/react/login");
    expect(currentUrl.searchParams.get("next")).toBe("/lobby/new");
    await expect(page.getByTestId("new-game-shell")).toHaveCount(0);
    expect(protectedRequests).toEqual([]);
    expect(
      (await page.context().cookies()).some((cookie) => cookie.name === "netrisk_session")
    ).toBe(false);
  });

  test("keeps login recovery actions for gameplay requests with an expired cookie", async ({
    page
  }) => {
    const resetPayload = await resetGame(page);
    const gameId = resetPayload?.state?.gameId;
    expect(gameId).toBeTruthy();
    await page.context().addCookies([
      {
        name: "netrisk_session",
        value: "expired-gameplay-session",
        url: getE2EBaseURL(),
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);

    await page.goto(`/react/game/${encodeURIComponent(gameId)}`);

    const gameError = page.getByTestId("react-shell-game-error");
    await expect(gameError).toBeVisible();
    await expect(gameError.getByRole("link", { name: /Accedi|Log in/i })).toBeVisible();
    await expect(gameError.getByRole("link", { name: /Registrati|Register/i })).toBeVisible();
    await expect(gameError.getByRole("button", { name: /Retry game/i })).toHaveCount(0);
  });
});
