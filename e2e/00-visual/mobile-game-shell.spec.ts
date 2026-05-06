const { test, expect } = require("@playwright/test");
const {
  registerAndLogin,
  resetGame,
  setSessionThemePreference,
  uniqueUser
} = require("../support/game-helpers");

async function openWorldClassicGame(page) {
  await resetGame(page);
  await page.goto("/game");
  const owner = uniqueUser("mobile_shell");
  const sessionToken = await registerAndLogin(page, owner);
  await setSessionThemePreference(page, sessionToken, "war-table");
  await page.evaluate(() => window.localStorage.setItem("netrisk.theme", "war-table"));
  await page.goto("/lobby/new");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-map").selectOption("world-classic");
  await page
    .locator("#setup-game-name")
    .fill(`Mobile Shell ${Date.now().toString(36).slice(-4)}`);
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-map-meta")).toContainText("World Classic", { timeout: 15000 });
  await expect(page.locator(".map-board.has-custom-background")).toBeVisible({ timeout: 15000 });
}

function intersects(first, second) {
  return !(
    first.right <= second.left ||
    second.right <= first.left ||
    first.bottom <= second.top ||
    second.bottom <= first.top
  );
}

test("mobile game shell keeps the map playable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorldClassicGame(page);

  const layout = await page.evaluate(() => {
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

    const boardStage = document.querySelector(".map-board.has-custom-background .map-board-stage");
    const boardStageBackground = boardStage ? window.getComputedStyle(boardStage).backgroundImage : "";

    return {
      activity: boundsFor(".game-right-utility-rail"),
      board: boundsFor(".game-map-stage .map-board"),
      boardStageBackground,
      dock: boundsFor(".game-command-dock"),
      rail: boundsFor(".game-action-rail"),
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth
      }
    };
  });

  expect(layout.boardStageBackground).toContain("world-classic");
  expect(layout.board.left).toBeGreaterThanOrEqual(-1);
  expect(layout.board.right).toBeLessThanOrEqual(layout.viewport.width + 1);
  expect(layout.board.width).toBeGreaterThanOrEqual(320);
  expect(layout.dock.left).toBeLessThanOrEqual(1);
  expect(layout.dock.right).toBeGreaterThanOrEqual(layout.viewport.width - 1);
  expect(intersects(layout.board, layout.rail)).toBe(false);
  expect(intersects(layout.board, layout.activity)).toBe(false);
  expect(intersects(layout.board, layout.dock)).toBe(false);
});
