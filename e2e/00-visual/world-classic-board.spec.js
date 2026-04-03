const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

async function openWorldClassicGame(page, suffix) {
  await resetGame(page);
  await page.goto("/game.html");
  const owner = uniqueUser(`wcv_${suffix}`);
  await registerAndLogin(page, owner);
  const sessionToken = await page.evaluate(() => localStorage.getItem("frontline-session-token"));
  const response = await page.request.post("/api/games", {
    headers: { "x-session-token": sessionToken || "" },
    data: {
      name: `World Classic Visual ${suffix} ${Date.now().toString(36).slice(-4)}`,
      mapId: "world-classic",
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "ai" }
      ]
    }
  });
  await expect(response.ok()).toBeTruthy();
  const data = await response.json();

  await page.goto(`/game.html?gameId=${encodeURIComponent(data.game.id)}`);

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
