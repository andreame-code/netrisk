const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

async function openWorldClassicGame(page, suffix) {
  await resetGame(page);
  await page.goto("/game.html");
  const normalizedSuffix = String(suffix).replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  const owner = uniqueUser(`mf_${normalizedSuffix}`);
  await registerAndLogin(page, owner);
  await page.goto("/new-game.html");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-map").selectOption("world-classic");
  await page.locator("#setup-game-name").fill(`Map Fit ${suffix} ${Date.now().toString(36).slice(-4)}`);
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-map-meta")).toContainText("World Classic", { timeout: 15000 });
  await expect(page.locator(".game-map-stage .map-board")).toBeVisible({ timeout: 15000 });
}

const viewports = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "compact", width: 1180, height: 760 }
];

for (const viewport of viewports) {
  test(`world classic map board stays inside the requested frame at ${viewport.name}`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWorldClassicGame(page, viewport.name);

    const metrics = await page.locator(".game-map-stage").evaluate((stage) => {
      const mapRegion = stage.querySelector(".map");
      const mapBoard = stage.querySelector(".map-board");
      if (!mapRegion || !mapBoard) {
        return null;
      }

      const mapRect = mapRegion.getBoundingClientRect();
      const boardRect = mapBoard.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const aspectRatioValue = mapBoard.style.aspectRatio || window.getComputedStyle(mapBoard).aspectRatio || "760 / 500";
      const match = aspectRatioValue.match(/([\d.]+)\s*\/\s*([\d.]+)/);
      const aspectRatio = match ? Number.parseFloat(match[1]) / Number.parseFloat(match[2]) : 760 / 500;
      const expectedHeightBudget = Math.min(mapRect.height, Math.max(0, viewportHeight - mapRect.top));
      const expectedWidth = Math.min(mapRect.width, expectedHeightBudget * aspectRatio);
      const expectedHeight = expectedWidth / aspectRatio;
      const appliedWidth = Math.floor(expectedWidth);
      const appliedHeight = Math.floor(expectedHeight);

      return {
        mapWidth: mapRect.width,
        mapHeight: mapRect.height,
        boardWidth: boardRect.width,
        boardHeight: boardRect.height,
        appliedWidth,
        appliedHeight,
        overflowTop: boardRect.top < mapRect.top - 1,
        overflowRight: boardRect.right > mapRect.right + 1,
        overflowBottom: boardRect.bottom > mapRect.bottom + 1,
        overflowLeft: boardRect.left < mapRect.left - 1,
        viewportOverflowBottom: boardRect.bottom > viewportHeight + 1
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.overflowTop).toBeFalsy();
    expect(metrics.overflowRight).toBeFalsy();
    expect(metrics.overflowBottom).toBeFalsy();
    expect(metrics.overflowLeft).toBeFalsy();
    expect(metrics.viewportOverflowBottom).toBeFalsy();
    expect(Math.abs(metrics.boardWidth - metrics.appliedWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.boardHeight - metrics.appliedHeight)).toBeLessThanOrEqual(1);
  });

  test(`turn summary panel stays under the map and inside the left column at ${viewport.name}`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWorldClassicGame(page, `${viewport.name}-summary`);

    const metrics = await page.evaluate(() => {
      const mainColumn = document.querySelector(".game-main-column");
      const mapStage = document.querySelector(".game-map-stage");
      const infoPanel = document.querySelector(".game-info-bottom");
      if (!mainColumn || !mapStage || !infoPanel) {
        return null;
      }

      const mainRect = mainColumn.getBoundingClientRect();
      const mapRect = mapStage.getBoundingClientRect();
      const infoRect = infoPanel.getBoundingClientRect();

      return {
        infoStartsBelowMap: infoRect.top >= mapRect.bottom - 1,
        infoInsideLeftColumnLeft: infoRect.left >= mainRect.left - 1,
        infoInsideLeftColumnRight: infoRect.right <= mainRect.right + 1,
        widthMatchesMainColumn: Math.abs(infoRect.width - mainRect.width) <= 2
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.infoStartsBelowMap).toBeTruthy();
    expect(metrics.infoInsideLeftColumnLeft).toBeTruthy();
    expect(metrics.infoInsideLeftColumnRight).toBeTruthy();
    expect(metrics.widthMatchesMainColumn).toBeTruthy();
  });
}
