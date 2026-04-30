const { test, expect } = require("@playwright/test");
const { attachSessionCookie, getE2EBaseURL, uniqueUser } = require("../support/game-helpers");

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

async function captureThemeSnapshot(page, selectors) {
  return page.evaluate(({ shellSelector, navSelector, primarySelector }) => {
    const root = getComputedStyle(document.documentElement);
    const shell = shellSelector ? document.querySelector(shellSelector) : null;
    const nav = navSelector ? document.querySelector(navSelector) : null;
    const primary = primarySelector ? document.querySelector(primarySelector) : null;
    return {
      accent: root.getPropertyValue("--accent").trim(),
      shellBg: shell ? getComputedStyle(shell).backgroundImage : "",
      navBg: nav ? getComputedStyle(nav).backgroundImage : "",
      primaryBg: primary ? getComputedStyle(primary).backgroundImage : ""
    };
  }, selectors);
}

async function selectTheme(page, theme) {
  const select = page.locator("#profile-theme-select");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await select.selectOption(theme);

    try {
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme, { timeout: 1000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }

      await page.waitForTimeout(150);
    }
  }
}

test("profile page lets the authenticated user choose a site theme", async ({ page, browser }) => {
  const username = uniqueUser("profile_theme");
  const password = "secret123";

  const sessionToken = await createAuthenticatedSession(page, username, password);
  await attachSessionCookie(page, sessionToken);

  await page.goto("/profile");

  await expect(page.locator("#profile-preferences")).toBeVisible();
  await expect(page.locator("#profile-theme-select")).toHaveValue("war-table");
  await expect.poll(async () => page.locator("#profile-theme-select option").evaluateAll((options) =>
    options.map((option) => option.getAttribute("value")).filter(Boolean)
  )).toEqual(["command", "midnight", "ember", "war-table"]);

  await selectTheme(page, "war-table");

  await expect(page.locator("#profile-theme-status")).toContainText("Tema applicato: Tavolo di guerra.");
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("netrisk.theme"))).toBe("war-table");

  await page.goto("/lobby");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "war-table");

  const secondContext = await browser.newContext();
  try {
    await secondContext.addCookies([{
      name: "netrisk_session",
      value: sessionToken,
      url: getE2EBaseURL(),
      httpOnly: true,
      sameSite: "Lax"
    }]);

    const secondPage = await secondContext.newPage();
    await secondPage.goto("/lobby");

    await expect(secondPage.locator("html")).toHaveAttribute("data-theme", "war-table");
  } finally {
    await secondContext.close();
  }
});

test("themes produce distinct visuals on shell, app page and landing", async ({ page }) => {
  const username = uniqueUser("profile_theme_visuals");
  const sessionToken = await createAuthenticatedSession(page, username);
  await attachSessionCookie(page, sessionToken);

  const profileSnapshots = new Map();
  const landingSnapshots = new Map();

  for (const theme of ["command", "midnight", "ember", "war-table"]) {
    await page.goto("/profile");
    await selectTheme(page, theme);
    profileSnapshots.set(
      theme,
      await captureThemeSnapshot(page, {
        shellSelector: ".profile-shell",
        navSelector: ".top-nav-bar",
        primarySelector: ".top-nav-register"
      })
    );

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    landingSnapshots.set(
      theme,
      await captureThemeSnapshot(page, {
        shellSelector: ".ld-header",
        navSelector: ".ld-header",
        primarySelector: ".ld-btn-primary"
      })
    );
  }

  expect(new Set(Array.from(profileSnapshots.values(), (snapshot) => snapshot.accent)).size).toBe(4);
  expect(new Set(Array.from(profileSnapshots.values(), (snapshot) => snapshot.shellBg)).size).toBe(4);
  expect(new Set(Array.from(profileSnapshots.values(), (snapshot) => snapshot.primaryBg)).size).toBe(4);
  expect(new Set(Array.from(landingSnapshots.values(), (snapshot) => snapshot.navBg)).size).toBe(4);
  expect(new Set(Array.from(landingSnapshots.values(), (snapshot) => snapshot.primaryBg)).size).toBe(4);
});
