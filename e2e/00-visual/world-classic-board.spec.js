const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

async function openWorldClassicGame(page, suffix) {
  await resetGame(page);
  await page.goto("/game.html");
  const owner = uniqueUser(`wcv_${suffix}`);
  await registerAndLogin(page, owner);
  await page.goto("/new-game.html");

  await expect(page.locator("#setup-map option[value='world-classic']")).toHaveCount(1);
  await expect(page.locator("#setup-map")).toHaveValue("classic-mini");
  await page.locator("#setup-map").selectOption("world-classic");
  await expect(page.locator("#setup-map")).toHaveValue("world-classic");
  await page.locator("#setup-game-name").fill(`World Classic Visual ${suffix} ${Date.now().toString(36).slice(-4)}`);
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-map-meta")).toContainText("World Classic");
  await expect(page.locator(".map-board.has-custom-background")).toBeVisible();
}

const viewports = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 1100, height: 900 }
];

for (const viewport of viewports) {
  test(`world classic armies stay visually centered at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWorldClassicGame(page, viewport.name);
    await expect(page.locator(".game-map-stage .map-board")).toHaveScreenshot(
      `world-classic-board-${viewport.name}.png`,
      { maxDiffPixels: 12000 }
    );
  });
}
