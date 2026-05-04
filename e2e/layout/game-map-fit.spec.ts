const { test, expect } = require("@playwright/test");
const {
  registerAndLogin,
  resetGame,
  setSessionThemePreference,
  uniqueUser
} = require("../support/game-helpers");

async function openWorldClassicGame(page, suffix) {
  await resetGame(page);
  await page.goto("/game");
  const normalizedSuffix = String(suffix)
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toLowerCase();
  const owner = uniqueUser(`mf_${normalizedSuffix}`);
  const sessionToken = await registerAndLogin(page, owner);
  await setSessionThemePreference(page, sessionToken, "war-table");
  await page.evaluate(() => window.localStorage.setItem("netrisk.theme", "war-table"));
  await page.goto("/lobby/new");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-map").selectOption("world-classic");
  await page
    .locator("#setup-game-name")
    .fill(`Map Fit ${suffix} ${Date.now().toString(36).slice(-4)}`);
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
  test(`world classic map board stays fully visible above the command dock at ${viewport.name}`, async ({
    page
  }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWorldClassicGame(page, viewport.name);

    const metrics = await page.locator(".game-map-stage").evaluate((stage) => {
      const mapRegion = stage.querySelector(".map");
      const mapBoard = stage.querySelector(".map-board");
      if (!mapRegion || !mapBoard) {
        return null;
      }

      const stageRect = stage.getBoundingClientRect();
      const mapRect = mapRegion.getBoundingClientRect();
      const boardRect = mapBoard.getBoundingClientRect();
      const actionsPanel = document.querySelector('[data-testid="actions-panel"]');
      const actionsRect = actionsPanel?.getBoundingClientRect();
      const safeMapBottom = actionsRect ? actionsRect.top - 8 : mapRect.bottom;
      const visibleMapHeight = Math.max(0, safeMapBottom - mapRect.top);

      return {
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        mapWidth: mapRect.width,
        mapHeight: mapRect.height,
        boardWidth: boardRect.width,
        boardHeight: boardRect.height,
        mapOccupiesMostStageWidth: mapRect.width >= stageRect.width * 0.72,
        mapOccupiesMostStageHeight: mapRect.height >= stageRect.height * 0.72,
        boardOccupiesMostSafeWidth: boardRect.width >= mapRect.width * 0.6,
        boardOccupiesMostSafeHeight: boardRect.height >= visibleMapHeight * 0.92,
        boardInsideMapTop: boardRect.top >= mapRect.top - 1,
        boardInsideMapRight: boardRect.right <= mapRect.right + 1,
        boardInsideSafeBottom: boardRect.bottom <= safeMapBottom + 1,
        boardInsideMapLeft: boardRect.left >= mapRect.left - 1,
        dockTop: actionsRect?.top || null,
        boardBottom: boardRect.bottom
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.mapWidth).toBeGreaterThan(0);
    expect(metrics.mapHeight).toBeGreaterThan(0);
    expect(metrics.mapOccupiesMostStageWidth).toBeTruthy();
    expect(metrics.mapOccupiesMostStageHeight).toBeTruthy();
    expect(metrics.boardOccupiesMostSafeWidth).toBeTruthy();
    expect(metrics.boardOccupiesMostSafeHeight).toBeTruthy();
    expect(metrics.boardInsideMapTop).toBeTruthy();
    expect(metrics.boardInsideMapRight).toBeTruthy();
    expect(metrics.boardInsideSafeBottom).toBeTruthy();
    expect(metrics.boardInsideMapLeft).toBeTruthy();
    expect(metrics.dockTop).toBeGreaterThan(metrics.boardBottom);
  });

  test(`turn HUD and command dock stay inside the map-first viewport at ${viewport.name}`, async ({
    page
  }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWorldClassicGame(page, `${viewport.name}-summary`);

    const metrics = await page.evaluate(() => {
      const mapStage = document.querySelector(".game-map-stage");
      const infoPanel = document.querySelector('[data-testid="info-panel"]');
      const actionsPanel = document.querySelector('[data-testid="actions-panel"]');
      if (!mapStage || !infoPanel || !actionsPanel) {
        return null;
      }

      const mapRect = mapStage.getBoundingClientRect();
      const infoRect = infoPanel.getBoundingClientRect();
      const actionsRect = actionsPanel.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      return {
        hudInsideMapTop: infoRect.top >= mapRect.top - 1,
        hudInsideMapLeft: infoRect.left >= mapRect.left - 1,
        hudInsideMapRight: infoRect.right <= mapRect.right + 1,
        hudInsideMapBottom: infoRect.bottom <= mapRect.bottom + 1,
        dockInsideViewportLeft: actionsRect.left >= -1,
        dockInsideViewportRight: actionsRect.right <= viewportWidth + 1,
        dockInsideViewportBottom: actionsRect.bottom <= viewportHeight + 1,
        hudAboveDock:
          infoRect.bottom <= actionsRect.top + 1 || infoRect.right <= actionsRect.left + 1
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.hudInsideMapTop).toBeTruthy();
    expect(metrics.hudInsideMapLeft).toBeTruthy();
    expect(metrics.hudInsideMapRight).toBeTruthy();
    expect(metrics.hudInsideMapBottom).toBeTruthy();
    expect(metrics.dockInsideViewportLeft).toBeTruthy();
    expect(metrics.dockInsideViewportRight).toBeTruthy();
    expect(metrics.dockInsideViewportBottom).toBeTruthy();
    expect(metrics.hudAboveDock).toBeTruthy();
  });
}

test("map controls stay inside the map frame and the actions rail keeps a stable compact layout", async ({
  page
}) => {
  test.slow();
  await page.setViewportSize({ width: 1180, height: 760 });
  await openWorldClassicGame(page, "compact-controls");
  const joinAiResponse = await page.request.post("/api/ai/join", {
    data: { name: "CPU Compact" }
  });
  await expect(joinAiResponse.ok()).toBeTruthy();
  await page.getByRole("button", { name: "Avvia partita" }).click();
  await expect(page.getByTestId("phase-indicator")).not.toHaveText(/lobby/i);
  await expect(page.locator("#reinforce-group")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const battlefield = document.querySelector('[data-testid="battlefield-layout"]');
    const mapRegion = document.querySelector('[data-testid="map-region"]');
    const controls = document.querySelector("[data-map-controls]");
    const actionsPanel = document.querySelector('[data-testid="actions-panel"]');
    const reinforceGroup = document.querySelector("#reinforce-group");
    const reinforceSelect = document.querySelector("#reinforce-select");
    const reinforceAmount = document.querySelector("#reinforce-amount");
    const reinforceButton = document.querySelector("#reinforce-multi-button");
    const cardTradeListInDock = actionsPanel.querySelector("#card-trade-list");
    if (
      !battlefield ||
      !mapRegion ||
      !controls ||
      !actionsPanel ||
      !reinforceGroup ||
      !reinforceSelect ||
      !reinforceAmount ||
      !reinforceButton
    ) {
      return null;
    }

    const battlefieldRect = battlefield.getBoundingClientRect();
    const mapRect = mapRegion.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    const actionsRect = actionsPanel.getBoundingClientRect();
    const reinforceRect = reinforceGroup.getBoundingClientRect();
    const reinforceSelectRect = reinforceSelect.getBoundingClientRect();
    const reinforceAmountRect = reinforceAmount.getBoundingClientRect();
    const reinforceButtonRect = reinforceButton.getBoundingClientRect();

    return {
      controlsInsideMapTop: controlsRect.top >= mapRect.top - 1,
      controlsInsideMapRight: controlsRect.right <= mapRect.right + 1,
      controlsInsideMapLeft: controlsRect.left >= mapRect.left - 1,
      actionsInsideBattlefieldTop: actionsRect.top >= battlefieldRect.top - 1,
      actionsInsideBattlefieldRight: actionsRect.right <= battlefieldRect.right + 1,
      actionsRailCompactHeight: actionsRect.height <= 86,
      commandDockCollapsed: actionsPanel.getAttribute("data-command-dock-expanded") === "false",
      cardTradeAbsentFromDock: cardTradeListInDock === null,
      reinforceGroupInsideActionsRail: reinforceRect.right <= actionsRect.right + 1,
      reinforceSelectInsideActionsRail: reinforceSelectRect.right <= actionsRect.right + 1,
      reinforceAmountInsideActionsRail: reinforceAmountRect.right <= actionsRect.right + 1,
      reinforceButtonInsideActionsRail: reinforceButtonRect.right <= actionsRect.right + 1
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics.controlsInsideMapTop).toBeTruthy();
  expect(metrics.controlsInsideMapRight).toBeTruthy();
  expect(metrics.controlsInsideMapLeft).toBeTruthy();
  expect(metrics.actionsInsideBattlefieldTop).toBeTruthy();
  expect(metrics.actionsInsideBattlefieldRight).toBeTruthy();
  expect(metrics.actionsRailCompactHeight).toBeTruthy();
  expect(metrics.commandDockCollapsed).toBeTruthy();
  expect(metrics.cardTradeAbsentFromDock).toBeTruthy();
  expect(metrics.reinforceGroupInsideActionsRail).toBeTruthy();
  expect(metrics.reinforceSelectInsideActionsRail).toBeTruthy();
  expect(metrics.reinforceAmountInsideActionsRail).toBeTruthy();
  expect(metrics.reinforceButtonInsideActionsRail).toBeTruthy();

  await page.locator(".game-command-dock-toggle").click();
  await expect(page.getByTestId("actions-panel")).toHaveAttribute(
    "data-command-dock-expanded",
    "true"
  );
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const actionsPanel = document.querySelector('[data-testid="actions-panel"]');
        const mapBoard = document.querySelector(".game-map-stage .map-board");
        if (!actionsPanel || !mapBoard) {
          return false;
        }

        const actionsRect = actionsPanel.getBoundingClientRect();
        const boardRect = mapBoard.getBoundingClientRect();
        return boardRect.bottom <= actionsRect.top + 1;
      })
    )
    .toBeTruthy();
});

test("short desktop viewport keeps the reference shell playable", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 600 });
  await openWorldClassicGame(page, "short-desktop");
  const joinAiResponse = await page.request.post("/api/ai/join", {
    data: { name: "CPU Short" }
  });
  await expect(joinAiResponse.ok()).toBeTruthy();
  await page.getByRole("button", { name: "Avvia partita" }).click();
  await expect(page.locator("#reinforce-group")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const boundsFor = (selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Missing ${selector}`);
      }

      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width
      };
    };
    const intersects = (first, second) =>
      !(
        first.right <= second.left ||
        second.right <= first.left ||
        first.bottom <= second.top ||
        second.bottom <= first.top
      );

    const hud = document.querySelector(".game-floating-hud");
    const board = boundsFor(".game-map-stage .map-board");
    const dock = boundsFor(".game-command-dock");
    const rail = boundsFor(".game-action-rail");
    const activity = boundsFor(".game-right-utility-rail");
    const viewport = {
      height: window.innerHeight,
      width: window.innerWidth
    };

    return {
      activityInsideViewport: activity.right <= viewport.width + 1 && activity.top >= -1,
      boardHeight: board.height,
      boardClearOfDock: !intersects(board, dock),
      boardInsideViewport: board.top >= -1 && board.right <= viewport.width + 1,
      boardWidth: board.width,
      dockInsideViewport:
        dock.left >= -1 && dock.right <= viewport.width + 1 && dock.bottom <= viewport.height + 1,
      hudHasNoHorizontalScrollbar: hud ? hud.scrollWidth <= hud.clientWidth + 1 : false,
      railAboveDock: rail.bottom <= dock.top + 1,
      railClearOfDock: !intersects(rail, dock)
    };
  });

  expect(metrics.boardWidth).toBeGreaterThanOrEqual(560);
  expect(metrics.boardHeight).toBeGreaterThanOrEqual(360);
  expect(metrics.boardInsideViewport).toBeTruthy();
  expect(metrics.boardClearOfDock).toBeTruthy();
  expect(metrics.dockInsideViewport).toBeTruthy();
  expect(metrics.railAboveDock).toBeTruthy();
  expect(metrics.railClearOfDock).toBeTruthy();
  expect(metrics.activityInsideViewport).toBeTruthy();
  expect(metrics.hudHasNoHorizontalScrollbar).toBeTruthy();
});
