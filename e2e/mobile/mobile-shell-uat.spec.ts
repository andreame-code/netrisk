const { test, expect } = require("@playwright/test");
const {
  attachSessionCookie,
  createAuthenticatedSession,
  resetGame,
  uniqueUser
} = require("../support/game-helpers");
const {
  expectKeyboardFocusRemainsUsable,
  expectTouchTarget,
  mobileProfile
} = require("../support/mobile-uat-helpers");

test("mobile profile exposes touch input and renders the public and protected shells", async ({
  page
}, testInfo) => {
  const expectedProfile = mobileProfile(testInfo.project.name);
  await resetGame(page);

  const runtimeProfile = await page.evaluate(() => ({
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    userAgent: navigator.userAgent,
    width: window.innerWidth,
    height: window.innerHeight
  }));
  expect(runtimeProfile.width).toBe(expectedProfile.width);
  expect(runtimeProfile.height).toBe(expectedProfile.height);
  if (expectedProfile.browser === "chromium") {
    expect(runtimeProfile.maxTouchPoints).toBeGreaterThan(0);
  }
  expect(runtimeProfile.coarsePointer).toBe(true);
  expect(runtimeProfile.userAgent).toMatch(
    expectedProfile.browser === "webkit" ? /iPhone|Mobile/i : /Android|Mobile/i
  );

  await page.goto("/");
  await expect(page.locator(".ld-header")).toBeVisible();
  await page.evaluate(() => {
    window.addEventListener(
      "touchstart",
      () => {
        document.body.dataset.mobileTouchReceived = "true";
      },
      { once: true }
    );
  });
  await page.locator(".ld-header").tap({ position: { x: 2, y: 2 } });
  await expect(page.locator("body")).toHaveAttribute("data-mobile-touch-received", "true");
  await expectTouchTarget(page.getByRole("link", { name: /Accedi|Log in/i }).first());

  await page.goto("/profile?tab=stats");
  await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
  const guardedUrl = new URL(page.url());
  expect(guardedUrl.pathname).toBe("/login");
  expect(guardedUrl.searchParams.get("next")).toBe("/profile?tab=stats");
  await expect(page.getByTestId("player-profile-shell")).toHaveCount(0);
});

test("mobile registration and login keep one keyboard-safe form", async ({ page }) => {
  await resetGame(page);
  const username = uniqueUser("mobile_auth_uat");
  const password = "secret123";

  await page.goto("/register?next=%2Fprofile");
  const registerPage = page.getByTestId("react-shell-register-page");
  const registerUsername = registerPage.locator('input[name="username"]');
  const registerPassword = registerPage.locator('input[name="password"]');
  const registerConfirm = registerPage.locator('input[name="password-confirm"]');
  const registerSubmit = registerPage.locator('button[type="submit"]');

  await expect(registerUsername).toHaveCount(1);
  await expect(registerPassword).toHaveCount(1);
  await expect(registerConfirm).toHaveCount(1);
  await expect(page.locator("#header-login-form")).toHaveCount(0);
  await expectTouchTarget(registerSubmit);
  await expectKeyboardFocusRemainsUsable(page, registerConfirm);

  await registerUsername.fill(username);
  await registerPassword.fill(password);
  await registerConfirm.fill(password);
  await registerSubmit.click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByTestId("player-profile-shell")).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login?next=%2Fprofile");
  const loginPage = page.getByTestId("react-shell-login-page");
  const loginUsername = loginPage.locator('input[name="username"]');
  const loginPassword = loginPage.locator('input[name="password"]');
  const loginSubmit = loginPage.locator('button[type="submit"]');

  await expect(loginUsername).toHaveCount(1);
  await expect(loginPassword).toHaveCount(1);
  await expect(page.locator("#header-login-form")).toHaveCount(0);
  await expectTouchTarget(loginSubmit);
  await expectKeyboardFocusRemainsUsable(page, loginPassword);

  await loginUsername.fill(username);
  await loginPassword.fill(password);
  await loginSubmit.click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByTestId("player-profile-shell")).toBeVisible();
});

test("mobile lobby renders deterministic empty, waiting, and full states", async ({ page }) => {
  await resetGame(page);
  await page.goto("/react/lobby");
  await expect(page.getByTestId("react-shell-lobby-page")).toBeVisible();
  await expect(page.locator("#game-list-state")).toContainText(
    /Nessuna partita disponibile|No games available/i
  );

  const ownerSession = await createAuthenticatedSession(page, uniqueUser("mobile_lobby_owner"));
  const waitingName = uniqueUser("mobile_waiting");
  const fullName = uniqueUser("mobile_full");
  const headers = { Cookie: `netrisk_session=${encodeURIComponent(ownerSession)}` };

  const waitingResponse = await page.request.post("/api/games", {
    headers,
    data: {
      name: waitingName,
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "human" }
      ]
    }
  });
  await expect(waitingResponse.ok()).toBeTruthy();

  const fullResponse = await page.request.post("/api/games", {
    headers,
    data: {
      name: fullName,
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "human" }
      ]
    }
  });
  await expect(fullResponse.ok()).toBeTruthy();
  const fullGame = await fullResponse.json();
  const joinerSession = await createAuthenticatedSession(page, uniqueUser("mobile_lobby_joiner"));
  const joinResponse = await page.request.post("/api/join", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(joinerSession)}` },
    data: { gameId: fullGame.game.id }
  });
  await expect(joinResponse.ok()).toBeTruthy();

  await page.context().clearCookies();
  await page.reload();
  const waitingRow = page.locator("[data-testid^='react-shell-lobby-row-']", {
    hasText: waitingName
  });
  const fullRow = page.locator("[data-testid^='react-shell-lobby-row-']", { hasText: fullName });
  await expect(waitingRow).toBeVisible({ timeout: 15000 });
  await expect(waitingRow).toContainText("1/2");
  await expect(fullRow).toBeVisible();
  await expect(fullRow).toContainText("2/2");
  await expectTouchTarget(waitingRow);
  await expectTouchTarget(fullRow);
});
