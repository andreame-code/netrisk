const { test, expect } = require("@playwright/test");
const { resetGame } = require("../support/game-helpers");

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

test.describe("anonymous mobile authentication header", () => {
  for (const viewport of phoneViewports) {
    test(`${viewport.width}x${viewport.height} keeps one compact login flow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await resetGame(page);
      await page.goto("/lobby");
      await expect(page.getByTestId("game-lobby-shell")).toBeVisible();

      const header = page.locator(".top-nav-bar");
      const headerBox = await header.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(headerBox.height).toBeLessThanOrEqual(120);

      await expect(page.locator("#header-login-form")).toBeHidden();
      await expectTouchTarget(page.locator("#header-login-link"));
      await expectTouchTarget(page.locator(".top-nav-brand"));
      await expectTouchTarget(page.locator(".top-nav-locale"));

      const navLinks = page.locator("#primary-top-nav .nav-link");
      await expect(navLinks).toHaveCount(3);
      for (let index = 0; index < (await navLinks.count()); index += 1) {
        await expectTouchTarget(navLinks.nth(index));
      }

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

      await username.focus();
      await expect(username).toBeFocused();
      await expectWithinViewport(page, username);
      await password.focus();
      await expect(password).toBeFocused();
      await expectWithinViewport(page, password);
      await submit.focus();
      await expect(submit).toBeFocused();
      await expectWithinViewport(page, submit);
    });
  }

  test("desktop retains quick login away from the dedicated login route", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await resetGame(page);
    await page.goto("/lobby");

    await expect(page.locator("#header-login-form")).toBeVisible();
    await expect(page.locator("#header-login-link")).toBeHidden();

    await page.goto("/login");
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
});
