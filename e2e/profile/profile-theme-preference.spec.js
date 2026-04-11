const { test, expect } = require("@playwright/test");
const { uniqueUser } = require("../support/game-helpers");

test("profile page lets the authenticated user choose a site theme", async ({ page, browser }) => {
  const username = uniqueUser("profile_theme");
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

  await page.context().addCookies([{
    name: "netrisk_session",
    value: sessionToken,
    url: "http://127.0.0.1:3100",
    httpOnly: true,
    sameSite: "Lax"
  }]);

  await page.goto("/profile.html");

  await expect(page.locator("#profile-preferences")).toBeVisible();
  await expect(page.locator("#profile-theme-select")).toHaveValue("command");

  await page.locator("#profile-theme-select").selectOption("midnight");

  await expect(page.locator("#profile-theme-status")).toContainText("Tema applicato: Mezzanotte.");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("netrisk.theme"))).toBe("midnight");

  await page.goto("/lobby.html");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");

  const secondContext = await browser.newContext();
  try {
    await secondContext.addCookies([{
      name: "netrisk_session",
      value: sessionToken,
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax"
    }]);

    const secondPage = await secondContext.newPage();
    await secondPage.goto("/lobby.html");

    await expect(secondPage.locator("html")).toHaveAttribute("data-theme", "midnight");
  } finally {
    await secondContext.close();
  }
});
