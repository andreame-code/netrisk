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
  await page.addInitScript(() => window.localStorage.setItem("netrisk.theme", "war-table"));
  await page.goto("/lobby/new");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-map").selectOption("world-classic");
  await page.locator("#setup-game-name").fill(`Mobile Shell ${Date.now().toString(36).slice(-4)}`);
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page.locator("#game-map-meta")).toContainText("World Classic", { timeout: 15000 });
  const joinAiResponse = await page.request.post("/api/ai/join", {
    data: { name: "CPU Mobile" }
  });
  await expect(joinAiResponse.ok()).toBeTruthy();
  await page.locator(".game-command-dock-toggle").click();
  await page.getByRole("button", { name: "Avvia partita" }).click();
  await expect(page.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:\s*[1-9]\d*/i, {
    timeout: 15000
  });
  await expect(page.locator(".map-board.has-custom-background")).toBeVisible({ timeout: 15000 });
}

const mobileViewports = [
  { width: 390, height: 844 },
  { width: 360, height: 780 },
  { width: 430, height: 932 }
];

async function openMockAttackGame(page) {
  const attackState = {
    phase: "active",
    turnPhase: "attack",
    players: [
      {
        id: "p1",
        name: "andrea",
        color: "#7c3aed",
        connected: true,
        isAi: false,
        territoryCount: 1,
        eliminated: false,
        cardCount: 3
      },
      {
        id: "p2",
        name: "CPU",
        color: "#f97316",
        connected: true,
        isAi: true,
        territoryCount: 1,
        eliminated: false,
        cardCount: 0
      }
    ],
    map: [
      {
        id: "western-united-states",
        name: "Western United States",
        neighbors: ["alberta"],
        continentId: "north-america",
        ownerId: "p1",
        armies: 4,
        x: 0.22,
        y: 0.38
      },
      {
        id: "alberta",
        name: "Alberta",
        neighbors: ["western-united-states"],
        continentId: "north-america",
        ownerId: "p2",
        armies: 2,
        x: 0.36,
        y: 0.3
      }
    ],
    continents: [],
    currentPlayerId: "p1",
    reinforcementPool: 0,
    winnerId: null,
    gameConfig: {
      mapId: "world-classic",
      mapName: "World Classic",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    },
    log: ["Attack layout visual state"],
    lastAction: null,
    pendingConquest: null,
    fortifyUsed: false,
    conqueredTerritoryThisTurn: false,
    attacksThisTurn: 0,
    cardState: {
      ruleSetId: "standard",
      tradeCount: 0,
      deckCount: 20,
      discardCount: 0,
      nextTradeBonus: 4,
      maxHandBeforeForcedTrade: 5,
      currentPlayerMustTrade: false
    },
    diceRuleSet: {
      id: "standard",
      attackerMaxDice: 3,
      defenderMaxDice: 2
    },
    gameId: "g-mobile-attack",
    version: 7,
    gameName: "Mobile Attack",
    playerId: "p1",
    playerHand: []
  };

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: "u1",
          username: "andrea",
          role: "user",
          authMethods: ["password"],
          preferences: { theme: "war-table" }
        }
      }
    });
  });

  await page.route("**/api/state**", async (route) => {
    await route.fulfill({ json: attackState });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: ""
    });
  });

  await page.addInitScript(() => window.localStorage.setItem("netrisk.theme", "war-table"));
  await page.goto("/react/game/g-mobile-attack");
  await expect(page.locator(".game-command-dock-attack")).toBeVisible();
}

async function readMobileAttackLayout(page) {
  return page.evaluate(() => {
    const rectFor = (selector) => {
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

    return {
      attack: rectFor("#attack-button"),
      banzai: rectFor("#attack-banzai-button"),
      dock: rectFor(".game-command-dock"),
      endTurn: rectFor("#end-turn-button"),
      header: rectFor("body[data-app-section='game'] .top-nav-bar"),
      mobileActions: document.querySelector(".game-mobile-sheet-actions")
        ? rectFor(".game-mobile-sheet-actions")
        : null,
      stage: rectFor(".game-map-stage"),
      toggle: rectFor(".game-command-dock-toggle"),
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth
      }
    };
  });
}

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
        sheetState: document
          .querySelector(".game-command-dock")
          ?.getAttribute("data-command-sheet-state"),
        title: window
          .getComputedStyle(document.querySelector("body[data-app-section='game'] .top-nav-title"), "::after")
          .content.replaceAll('"', ""),
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth
        }
      };
    });

    expect(layout.viewport).toEqual(viewport);
    expect(layout.boardStageBackground).toContain("world-classic");
    expect(layout.header.height).toBeLessThanOrEqual(60);
    expect(layout.title).toBe("NETRISK");
    expect(layout.board.width).toBeGreaterThan(layout.viewport.width);
    expect(layout.board.height).toBeGreaterThanOrEqual(layout.viewport.height * 0.42);
    expect(layout.dock.left).toBeLessThanOrEqual(1);
    expect(layout.dock.right).toBeGreaterThanOrEqual(layout.viewport.width - 1);
    expect(layout.dock.height).toBeGreaterThanOrEqual(70);
    expect(layout.dock.height).toBeLessThanOrEqual(112);
    expect(layout.sheetState).toBe("collapsed");
    expect(layout.hud.width).toBeLessThan(layout.viewport.width);

    await page.locator(".game-command-dock-toggle").click();
    await expect(page.locator(".game-command-dock")).toHaveAttribute(
      "data-command-sheet-state",
      "half-open"
    );

    const halfOpenLayout = await page.evaluate(() => {
      const primaryDockButton =
        document.querySelector("#reinforce-multi-button") ||
        document.querySelector("#attack-button") ||
        document.querySelector("#conquest-button") ||
        document.querySelector("#fortify-button") ||
        document.querySelector("#join-button") ||
        document.querySelector("#start-button");

      if (!primaryDockButton) {
        throw new Error("Missing primary dock button");
      }

      const dockRect = document.querySelector(".game-command-dock").getBoundingClientRect();
      const buttonRect = primaryDockButton.getBoundingClientRect();

      return {
        dock: {
          bottom: dockRect.bottom,
          height: dockRect.height,
          top: dockRect.top
        },
        primaryDockButton: {
          bottom: buttonRect.bottom,
          height: buttonRect.height,
          top: buttonRect.top
        },
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth
        }
      };
    });

    expect(halfOpenLayout.dock.height).toBeGreaterThanOrEqual(180);
    expect(halfOpenLayout.dock.height).toBeLessThanOrEqual(
      halfOpenLayout.viewport.height * 0.32
    );
    expect(halfOpenLayout.primaryDockButton.height).toBeGreaterThanOrEqual(44);
    expect(halfOpenLayout.primaryDockButton.bottom).toBeLessThanOrEqual(
      halfOpenLayout.viewport.height + 1
    );

    await page.locator(".game-command-dock-toggle").click();
    await expect(page.locator(".game-command-dock")).toHaveAttribute(
      "data-command-sheet-state",
      "expanded"
    );
    await expect(page.locator(".game-mobile-sheet-actions")).toBeVisible();
  }
});

test("mobile attack sheet keeps primary actions visible and expands only secondary actions", async ({
  page
}) => {
  await page.setViewportSize(mobileViewports[0]);
  await openMockAttackGame(page);

  await page.locator(".game-command-dock-toggle").click();
  await expect(page.locator(".game-command-dock")).toHaveAttribute(
    "data-command-sheet-state",
    "half-open"
  );
  await expect(page.locator("#attack-button")).toBeVisible();
  await expect(page.locator("#attack-banzai-button")).toBeVisible();
  await expect(page.locator("#end-turn-button")).toBeVisible();
  await expect(page.locator(".game-mobile-sheet-actions")).toBeHidden();

  const halfOpenLayout = await readMobileAttackLayout(page);
  for (const button of [
    halfOpenLayout.attack,
    halfOpenLayout.banzai,
    halfOpenLayout.endTurn,
    halfOpenLayout.toggle
  ]) {
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.top).toBeGreaterThanOrEqual(0);
    expect(button.bottom).toBeLessThanOrEqual(halfOpenLayout.viewport.height + 1);
  }
  expect(halfOpenLayout.dock.height).toBeGreaterThanOrEqual(390);
  expect(halfOpenLayout.dock.height).toBeLessThanOrEqual(410);
  expect(halfOpenLayout.dock.top - halfOpenLayout.header.bottom).toBeGreaterThan(240);

  await page.locator(".game-command-dock-toggle").click();
  await expect(page.locator(".game-command-dock")).toHaveAttribute(
    "data-command-sheet-state",
    "expanded"
  );
  await expect(page.locator(".game-mobile-sheet-actions")).toBeVisible();

  const expandedLayout = await readMobileAttackLayout(page);
  expect(expandedLayout.dock.height).toBeLessThanOrEqual(500);
  expect(expandedLayout.dock.top - expandedLayout.header.bottom).toBeGreaterThan(160);
  expect(expandedLayout.toggle.top).toBeGreaterThanOrEqual(0);
  expect(expandedLayout.toggle.bottom).toBeLessThanOrEqual(expandedLayout.viewport.height + 1);
  expect(expandedLayout.mobileActions.bottom).toBeLessThanOrEqual(
    expandedLayout.viewport.height + 1
  );

  await page.locator(".game-command-dock-toggle").click();
  await expect(page.locator(".game-command-dock")).toHaveAttribute(
    "data-command-sheet-state",
    "collapsed"
  );
});
