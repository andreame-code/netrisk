const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("lobby shows 15 games initially and loads more on scroll", async ({ page }) => {
  test.slow();
  await resetGame(page);
  await page.goto("/game");
  await registerAndLogin(page, uniqueUser("scroll_owner"));

  const gameNames = Array.from({ length: 34 }, (_, index) => uniqueUser(`scroll_${String(index + 1).padStart(2, "0")}`));
  for (const gameName of gameNames) {
    const response = await page.request.post("/api/games", {
      data: { name: gameName }
    });
    await expect(response.ok()).toBeTruthy();
  }

  await page.goto("/lobby");

  const rows = page.locator("#game-session-list [data-game-id]");
  await expect(rows).toHaveCount(15);
  await expect(page.locator("#game-list-load-more-state")).toContainText("Mostrate 15 di");

  await page.locator("#game-list-load-more-state").scrollIntoViewIfNeeded();

  await expect.poll(async () => rows.count()).toBeGreaterThan(15);
  await expect(rows).toHaveCount(30);
  await expect(page.locator("#game-list-load-more-state")).toContainText("Mostrate 30 di");

  await page.locator("#game-list-load-more-state").scrollIntoViewIfNeeded();

  await expect.poll(async () => rows.count()).toBeGreaterThan(30);
  await expect(page.locator("#game-list-load-more-state")).not.toContainText("Mostrate 30 di");
});

