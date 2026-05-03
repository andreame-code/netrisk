const { test, expect } = require("@playwright/test");
const {
  registerAndLogin,
  registerLoginAndJoin,
  resetGame,
  uniqueUser
} = require("../support/game-helpers");

async function openWorldClassicGame(page, suffix) {
  await resetGame(page);
  await page.goto("/game");
  const owner = uniqueUser(`mvp_${suffix}`);
  await registerAndLogin(page, owner);
  await page.goto("/lobby/new");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-map").selectOption("world-classic");
  await page
    .locator("#setup-game-name")
    .fill(`Map Viewport ${suffix} ${Date.now().toString(36).slice(-4)}`);
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-map-meta")).toContainText("World Classic", { timeout: 15000 });
  await expect(page.locator("[data-map-surface]")).toBeVisible({ timeout: 15000 });

  return owner;
}

async function maxTerritoryMarkerError(page) {
  return page.evaluate(() => {
    const board = document.querySelector(".map-board");
    const markers = Array.from(document.querySelectorAll("[data-territory-id]"));
    if (!board || markers.length === 0) {
      return null;
    }

    const boardRect = board.getBoundingClientRect();
    return markers.reduce((maxError, marker) => {
      const markerRect = marker.getBoundingClientRect();
      const x = Number(marker.getAttribute("data-map-position-x") || "50");
      const y = Number(marker.getAttribute("data-map-position-y") || "50");
      const expectedX = boardRect.left + (boardRect.width * x) / 100;
      const expectedY = boardRect.top + (boardRect.height * y) / 100;
      const actualX = markerRect.left + markerRect.width / 2;
      const actualY = markerRect.top + markerRect.height / 2;
      return Math.max(maxError, Math.hypot(actualX - expectedX, actualY - expectedY));
    }, 0);
  });
}

test("map viewport supports zoom, drag, and returns to fit with zoom out", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 960 });
  await openWorldClassicGame(page, "interactions");
  const surface = page.locator("[data-map-surface]");
  const firstTerritory = page.locator("[data-territory-id]").first();
  const zoomOutButton = page.locator('[data-map-control="zoom-out"]');

  const initialViewport = await surface.evaluate((node) => ({
    scale: Number(node.getAttribute("data-map-scale") || "0"),
    translateX: Number(node.getAttribute("data-map-translate-x") || "0"),
    translateY: Number(node.getAttribute("data-map-translate-y") || "0")
  }));
  const initialTerritorySize = await firstTerritory.boundingBox();

  expect(initialViewport.scale).toBeCloseTo(1, 3);
  expect(initialViewport.translateX).toBeCloseTo(0, 1);
  expect(initialViewport.translateY).toBeCloseTo(0, 1);
  expect(initialTerritorySize).not.toBeNull();
  await expect(zoomOutButton).toBeDisabled();
  await expect.poll(() => maxTerritoryMarkerError(page)).toBeLessThanOrEqual(2.5);

  const box = await surface.boundingBox();
  if (!box) {
    throw new Error("Map surface bounding box unavailable.");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 900, box.y + box.height / 2 + 700, {
    steps: 16
  });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const x = Number(await surface.getAttribute("data-map-translate-x"));
      const y = Number(await surface.getAttribute("data-map-translate-y"));
      return Math.hypot(x, y);
    })
    .toBeGreaterThan(100);
  await expect(zoomOutButton).toBeEnabled();

  const centeredCorner = await page.evaluate(() => {
    const stage = document.querySelector(".game-map-stage");
    const surfaceElement = document.querySelector("[data-map-surface]");
    const board = document.querySelector(".map-board");
    if (!stage || !surfaceElement || !board) {
      return null;
    }

    const stageStyles = window.getComputedStyle(stage);
    const safeTop = Number.parseFloat(stageStyles.getPropertyValue("--game-map-safe-top") || "0");
    const safeBottom = Number.parseFloat(
      stageStyles.getPropertyValue("--game-map-safe-bottom") || "0"
    );
    const surfaceRect = surfaceElement.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const safeCenterX = surfaceRect.left + surfaceRect.width / 2;
    const safeCenterY = surfaceRect.top + safeTop + (surfaceRect.height - safeTop - safeBottom) / 2;

    return {
      xError: Math.abs(boardRect.left - safeCenterX),
      yError: Math.abs(boardRect.top - safeCenterY)
    };
  });
  expect(centeredCorner).not.toBeNull();
  expect(centeredCorner.xError).toBeLessThanOrEqual(2.5);
  expect(centeredCorner.yError).toBeLessThanOrEqual(2.5);

  await zoomOutButton.click();
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeCloseTo(1, 2);
  await expect
    .poll(async () => Math.abs(Number(await surface.getAttribute("data-map-translate-x"))))
    .toBeLessThan(1);
  await expect
    .poll(async () => Math.abs(Number(await surface.getAttribute("data-map-translate-y"))))
    .toBeLessThan(1);
  await expect(zoomOutButton).toBeDisabled();

  await surface.hover();
  await page.mouse.wheel(0, -500);

  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeGreaterThan(1.05);
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-node-scale")))
    .toBeCloseTo(1, 4);
  await expect(zoomOutButton).toBeEnabled();

  const zoomedTerritorySize = await firstTerritory.boundingBox();
  expect(zoomedTerritorySize).not.toBeNull();
  expect(
    Math.abs((zoomedTerritorySize?.width || 0) - (initialTerritorySize?.width || 0))
  ).toBeLessThanOrEqual(4.5);
  expect(
    Math.abs((zoomedTerritorySize?.height || 0) - (initialTerritorySize?.height || 0))
  ).toBeLessThanOrEqual(4.5);

  const beforeDrag = await surface.evaluate((node) => ({
    x: Number(node.getAttribute("data-map-translate-x") || "0"),
    y: Number(node.getAttribute("data-map-translate-y") || "0")
  }));

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2 + 70, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const x = Number(await surface.getAttribute("data-map-translate-x"));
      const y = Number(await surface.getAttribute("data-map-translate-y"));
      return Math.hypot(x - beforeDrag.x, y - beforeDrag.y);
    })
    .toBeGreaterThan(25);
  await expect.poll(() => maxTerritoryMarkerError(page)).toBeLessThanOrEqual(2.5);

  await zoomOutButton.click();
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeCloseTo(1, 2);
  await expect
    .poll(async () => Math.abs(Number(await surface.getAttribute("data-map-translate-x"))))
    .toBeLessThan(1);
  await expect
    .poll(async () => Math.abs(Number(await surface.getAttribute("data-map-translate-y"))))
    .toBeLessThan(1);
  await expect(zoomOutButton).toBeDisabled();
});

test("map viewport control buttons zoom in and out coherently", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 960 });
  await openWorldClassicGame(page, "controls");
  const surface = page.locator("[data-map-surface]");
  const zoomInButton = page.locator('[data-map-control="zoom-in"]');
  const zoomOutButton = page.locator('[data-map-control="zoom-out"]');

  await zoomInButton.click();
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeGreaterThan(1.1);
  await expect(zoomOutButton).toBeEnabled();

  const zoomedScale = Number(await surface.getAttribute("data-map-scale"));
  await zoomOutButton.click();

  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeLessThan(zoomedScale);
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeCloseTo(1, 2);
  await expect(zoomOutButton).toBeDisabled();
});

test("dragging a zoomed map does not select a territory until an explicit click", async ({
  browser
}) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("mzd_a");
  const secondUser = uniqueUser("mzd_b");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(firstPage.getByTestId("phase-indicator")).not.toHaveText(/lobby/i);

  const surface = firstPage.locator("[data-map-surface]");
  const zoomInButton = firstPage.locator('[data-map-control="zoom-in"]');
  const zoomOutButton = firstPage.locator('[data-map-control="zoom-out"]');
  const myTerritory = firstPage
    .locator("[data-territory-id]")
    .filter({ hasText: firstUser })
    .first();
  await expect(myTerritory).toBeVisible();

  await zoomInButton.click();
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeGreaterThan(1.05);

  const territoryId = await myTerritory.getAttribute("data-territory-id");
  const reinforceBeforeDrag = await firstPage.locator("#reinforce-select").inputValue();
  const attackBeforeDrag = await firstPage.locator("#attack-from").inputValue();
  const territoryBox = await myTerritory.boundingBox();
  if (!territoryBox) {
    throw new Error("Owned territory bounding box unavailable.");
  }

  await firstPage.mouse.move(
    territoryBox.x + territoryBox.width / 2,
    territoryBox.y + territoryBox.height / 2
  );
  await firstPage.mouse.down();
  await firstPage.mouse.move(
    territoryBox.x + territoryBox.width / 2 + 120,
    territoryBox.y + territoryBox.height / 2 + 70,
    {
      steps: 12
    }
  );
  await firstPage.mouse.up();

  await expect(firstPage.locator("#reinforce-select")).toHaveValue(reinforceBeforeDrag);
  await expect(firstPage.locator("#attack-from")).toHaveValue(attackBeforeDrag);

  await zoomOutButton.click();
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeCloseTo(1, 2);
  await expect(firstPage.locator("#reinforce-select")).toHaveValue(reinforceBeforeDrag);
  await expect(firstPage.locator("#attack-from")).toHaveValue(attackBeforeDrag);

  await myTerritory.click();
  await expect(firstPage.locator("#reinforce-select")).toHaveValue(territoryId || "");
  await expect(firstPage.locator("#attack-from")).toHaveValue(territoryId || "");

  await firstContext.close();
  await secondContext.close();
});
