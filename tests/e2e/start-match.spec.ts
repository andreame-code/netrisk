import { test, expect } from "@playwright/test";
import { authenticate, setupLobby } from "./utils";

test.describe("start match flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.innerHTML =
        "* { transition: none !important; animation: none !important; }";
      document.head.appendChild(style);
    });
    await page.route("**/supabase.co/**", (route) => {
      route.fulfill({
        status: 200,
        body: "{}",
        headers: { "content-type": "application/json" },
      });
    });
  });

  test("two players start a match and enter reinforce phase", async ({
    page,
  }) => {
    await authenticate(page);
    await setupLobby(page);
    await page.goto("/setup.html");
    await expect(page.getByText("Unable to load data")).toHaveCount(0);
    await expect(page.locator("#name0")).toHaveValue("Red");
    await expect(page.locator("#name1")).toHaveValue("Blue");
    await page.waitForSelector("#mapGrid .map-item");
    await page.click('button[type="submit"]');
    await page.goto("/game.html");
    await expect(page.locator("#status")).toHaveText("reinforce");
  });
});
