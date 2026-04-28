const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

async function openWorldClassicGame(page, suffix) {
  await resetGame(page);
  await page.goto("/game");
  const owner = uniqueUser(`wcv_${suffix}`);
  await registerAndLogin(page, owner);
  await page.goto("/lobby/new");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-map").selectOption("world-classic");
  await page.locator("#setup-game-name").fill(`World Classic ${suffix}`);
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-map-meta")).toContainText("World Classic", { timeout: 15000 });
  await expect(page.locator(".map-board.has-custom-background")).toBeVisible({ timeout: 15000 });
}

const viewports = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 1100, height: 900 }
];

for (const viewport of viewports) {
test(`world classic armies stay visually centered at ${viewport.name}`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWorldClassicGame(page, viewport.name);
    await expect(page.locator(".game-map-stage .map-board")).toHaveScreenshot(
      `world-classic-board-${viewport.name}.png`,
      { timeout: 15000, maxDiffPixels: 12000 }
    );
  });
}
