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
  test(`world classic map board fills the map-first surface at ${viewport.name}`, async ({
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
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      return {
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        mapWidth: mapRect.width,
        mapHeight: mapRect.height,
        boardWidth: boardRect.width,
        boardHeight: boardRect.height,
        mapOccupiesMostStageWidth: mapRect.width >= stageRect.width * 0.72,
        mapOccupiesMostStageHeight: mapRect.height >= stageRect.height * 0.72,
        boardCoversMapWidth: boardRect.width >= mapRect.width - 2,
        boardCoversMapHeight: boardRect.height >= mapRect.height - 2,
        noBlankTop: boardRect.top <= mapRect.top + 1,
        noBlankRight: boardRect.right >= mapRect.right - 1,
        noBlankBottom: boardRect.bottom >= mapRect.bottom - 1,
        noBlankLeft: boardRect.left <= mapRect.left + 1,
        viewportOverflowRight: boardRect.left > viewportWidth + 1,
        viewportOverflowBottom: boardRect.top > viewportHeight + 1
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.mapWidth).toBeGreaterThan(0);
    expect(metrics.mapHeight).toBeGreaterThan(0);
    expect(metrics.mapOccupiesMostStageWidth).toBeTruthy();
    expect(metrics.mapOccupiesMostStageHeight).toBeTruthy();
    expect(metrics.boardCoversMapWidth).toBeTruthy();
    expect(metrics.boardCoversMapHeight).toBeTruthy();
    expect(metrics.noBlankTop).toBeTruthy();
    expect(metrics.noBlankRight).toBeTruthy();
    expect(metrics.noBlankBottom).toBeTruthy();
    expect(metrics.noBlankLeft).toBeTruthy();
    expect(metrics.viewportOverflowRight).toBeFalsy();
    expect(metrics.viewportOverflowBottom).toBeFalsy();
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
  expect(metrics.reinforceGroupInsideActionsRail).toBeTruthy();
  expect(metrics.reinforceSelectInsideActionsRail).toBeTruthy();
  expect(metrics.reinforceAmountInsideActionsRail).toBeTruthy();
  expect(metrics.reinforceButtonInsideActionsRail).toBeTruthy();
});
