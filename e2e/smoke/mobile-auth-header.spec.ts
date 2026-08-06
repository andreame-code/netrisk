const { test, expect } = require("@playwright/test");
const {
  attachSessionCookie,
  createAuthenticatedSession,
  resetGame,
  uniqueUser
} = require("../support/game-helpers");

const phoneViewports = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
];

async function expectTouchTarget(locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

async function expectWithinViewport(page, locator) {
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

async function expectUsableWithReducedViewport(page, locator, viewport, additionalLocators = []) {
  await page.setViewportSize({
    width: viewport.width,
    height: Math.max(420, viewport.height - 360)
  });
  await locator.focus();
  await expect(locator).toBeFocused();
  await expectWithinViewport(page, locator);
  for (const additionalLocator of additionalLocators) {
    await expectWithinViewport(page, additionalLocator);
  }
  await page.setViewportSize(viewport);
}

test.describe("anonymous mobile authentication header", () => {
  for (const viewport of phoneViewports) {
    test(`${viewport.width}x${viewport.height} keeps one compact login flow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(
        (theme) => {
          window.localStorage.setItem("netrisk.theme", theme);
        },
        viewport.width === 390 ? "war-table" : "command"
      );
      await resetGame(page);
      await page.goto("/lobby");
      await expect(page.getByTestId("game-lobby-shell")).toBeVisible();

      const header = page.locator(".top-nav-bar");
      const headerBox = await header.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(headerBox.height).toBeLessThanOrEqual(120);

      await expect(page.locator("#header-login-form")).toBeHidden();
      await expect(page.locator(".war-nav-user")).toBeHidden();
      await expectTouchTarget(page.locator("#header-login-link"));
      await expectTouchTarget(page.locator(".top-nav-brand"));
      await expectTouchTarget(page.locator(".top-nav-locale"));
      const localeBox = await page.locator(".top-nav-locale").boundingBox();
      const loginBox = await page.locator("#header-login-link").boundingBox();
      expect(localeBox).not.toBeNull();
      expect(loginBox).not.toBeNull();
      expect(localeBox.x + localeBox.width).toBeLessThanOrEqual(loginBox.x);

      const navLinks = page.locator("#primary-top-nav .nav-link");
      await expect(navLinks).toHaveCount(3);
      for (let index = 0; index < (await navLinks.count()); index += 1) {
        await expectTouchTarget(navLinks.nth(index));
      }

      await page.goto("/game/header-uat-missing");
      await expect(page.locator("body")).toHaveAttribute("data-app-section", "game");
      await expect(page.getByTestId("react-shell-game-error")).toBeVisible();
      await expect(page.locator("#header-login-form")).toBeHidden();
      await expect(page.locator(".war-nav-user")).toBeHidden();
      await expectTouchTarget(page.locator("#header-login-link"));
      const gameLocaleBox = await page.locator(".top-nav-locale").boundingBox();
      const gameLoginBox = await page.locator("#header-login-link").boundingBox();
      expect(gameLocaleBox).not.toBeNull();
      expect(gameLoginBox).not.toBeNull();
      await expectTouchTarget(page.locator(".top-nav-locale"));
      await expectWithinViewport(page, page.locator(".top-nav-locale"));
      await expectWithinViewport(page, page.locator("#header-login-link"));
      expect(gameLocaleBox.x + gameLocaleBox.width).toBeLessThanOrEqual(gameLoginBox.x);
      if (viewport.width === 390) {
        expect(gameLocaleBox.width).toBeGreaterThanOrEqual(52);
        expect(gameLocaleBox.height).toBeGreaterThanOrEqual(44);
        await expect(page.locator(".top-nav-locale-select")).toHaveCSS("opacity", "0");
        await expect(page.locator(".war-nav-locale-icon")).toBeVisible();
      } else {
        expect(gameLocaleBox.width).toBeGreaterThanOrEqual(96);
        await expect(page.locator(".top-nav-locale-select")).toHaveCSS("opacity", "1");
        await expect(page.locator(".war-nav-locale-icon")).toBeHidden();
      }

      await page.goto("/register?next=%2Fgame%2Fheader-return-target");
      await expect(page.getByTestId("react-shell-register-page")).toBeVisible();
      await expect(page.locator("#header-login-link")).toHaveAttribute(
        "href",
        "/login?next=%2Fgame%2Fheader-return-target"
      );

      await page.goto("/lobby");

      await page.locator("#header-login-link").click();
      await expect(page).toHaveURL(/\/login\?next=%2Flobby$/);
      await expect(page.locator("#header-login-form")).toHaveCount(0);
      await expect(page.locator("#header-login-link")).toHaveCount(0);

      const loginPage = page.getByTestId("react-shell-login-page");
      const username = loginPage.locator('input[name="username"]');
      const password = loginPage.locator('input[name="password"]');
      const submit = loginPage.locator('button[type="submit"]');
      await expect(username).toHaveCount(1);
      await expect(password).toHaveCount(1);
      await expect(submit).toHaveCount(1);
      await expect(username).toHaveAttribute("autocomplete", "username");
      await expect(password).toHaveAttribute("autocomplete", "current-password");

      await expectUsableWithReducedViewport(page, username, viewport);
      await expectUsableWithReducedViewport(page, password, viewport, [submit]);
    });
  }

  test("desktop retains quick login away from the dedicated login route", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await resetGame(page);
    await page.goto("/lobby");

    await expect(page.locator("#header-login-form")).toBeVisible();
    await expect(page.locator("#header-login-link")).toBeHidden();

    await page.goto("/login/");
    await expect(page.locator("#header-login-form")).toHaveCount(0);
    await expect(page.locator("#header-auth-username")).toHaveCount(0);
    await expect(page.locator("#header-auth-password")).toHaveCount(0);
    await expect(
      page.getByTestId("react-shell-login-page").locator('input[name="username"]')
    ).toHaveCount(1);
    await expect(
      page.getByTestId("react-shell-login-page").locator('input[name="password"]')
    ).toHaveCount(1);
  });

  test("authenticated mobile headers keep their existing layout without overlap", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.setItem("netrisk.theme", "war-table");
    });
    await resetGame(page);
    const sessionToken = await createAuthenticatedSession(page, uniqueUser("mobile_header"));
    await attachSessionCookie(page, sessionToken);
    await page.goto("/profile");
    await expect(page.getByTestId("player-profile-shell")).toBeVisible();

    const header = page.locator(".top-nav-bar");
    await expect(header).toHaveClass(/is-authenticated/);
    await expect(header).not.toHaveClass(/is-anonymous/);
    await expect(page.locator("#header-login-form")).toHaveCount(0);
    await expect(page.locator("#header-login-link")).toHaveCount(0);
    await expect(page.locator(".war-nav-user")).toBeVisible();

    const actionsBox = await page.locator(".top-nav-actions").boundingBox();
    const navBox = await page.locator("#primary-top-nav").boundingBox();
    expect(actionsBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    const verticallySeparated =
      actionsBox.y + actionsBox.height <= navBox.y || navBox.y + navBox.height <= actionsBox.y;
    expect(verticallySeparated).toBe(true);
  });
});
