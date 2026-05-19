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
  await page.locator("#setup-game-name").fill(`Mobile Shell ${Date.now().toString(36).slice(-4)}`);
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-map-meta")).toContainText("World Classic", { timeout: 15000 });
  await expect(page.locator(".map-board.has-custom-background")).toBeVisible({ timeout: 15000 });
}

const mobileViewports = [
  { width: 390, height: 844 },
  { width: 360, height: 780 },
  { width: 430, height: 932 }
];

test("mobile game shell keeps the map-first sheet layout playable", async ({ page }) => {
  await page.setViewportSize(mobileViewports[0]);
  await openWorldClassicGame(page);

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.locator(".map-board.has-custom-background")).toBeVisible({
      timeout: 15000
    });

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

      const boardStage = document.querySelector(
        ".map-board.has-custom-background .map-board-stage"
      );
      const boardStageBackground = boardStage
        ? window.getComputedStyle(boardStage).backgroundImage
        : "";
      const primaryDockButton =
        document.querySelector("#reinforce-multi-button") ||
        document.querySelector("#attack-button") ||
        document.querySelector("#conquest-button") ||
        document.querySelector("#fortify-button") ||
        document.querySelector("#join-button") ||
        document.querySelector("#start-button");

      return {
        activity: boundsFor(".game-right-utility-rail"),
        board: boundsFor(".game-map-stage .map-board"),
        boardStageBackground,
        dock: boundsFor(".game-command-dock"),
        header: boundsFor("body[data-app-section='game'] .top-nav-bar"),
        hud: boundsFor(".game-floating-hud"),
        primaryDockButton: primaryDockButton
          ? {
              bottom: primaryDockButton.getBoundingClientRect().bottom,
              height: primaryDockButton.getBoundingClientRect().height,
              top: primaryDockButton.getBoundingClientRect().top
            }
          : null,
        rail: boundsFor(".game-action-rail"),
        sheetState: document
          .querySelector(".game-command-dock")
          ?.getAttribute("data-command-sheet-state"),
        title: document.querySelector("body[data-app-section='game'] .top-nav-title")?.textContent,
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth
        }
      };
    });

    expect(layout.viewport).toEqual(viewport);
    expect(layout.boardStageBackground).toContain("world-classic");
    expect(layout.header.height).toBeLessThanOrEqual(60);
    expect(layout.title).toContain("Frontline Dominion");
    expect(layout.board.width).toBeGreaterThan(layout.viewport.width);
    expect(layout.board.height).toBeGreaterThanOrEqual(layout.viewport.height * 0.42);
    expect(layout.dock.left).toBeLessThanOrEqual(1);
    expect(layout.dock.right).toBeGreaterThanOrEqual(layout.viewport.width - 1);
    expect(layout.dock.height).toBeGreaterThanOrEqual(190);
    expect(layout.dock.height).toBeLessThanOrEqual(layout.viewport.height * 0.34);
    expect(layout.sheetState).toBe("half-open");
    expect(layout.hud.width).toBeLessThan(layout.viewport.width);
    expect(layout.rail.height).toBeGreaterThanOrEqual(44);
    expect(layout.activity.height).toBeGreaterThanOrEqual(44);
    expect(layout.primaryDockButton?.height).toBeGreaterThanOrEqual(44);
    expect(layout.primaryDockButton?.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
  }
});
