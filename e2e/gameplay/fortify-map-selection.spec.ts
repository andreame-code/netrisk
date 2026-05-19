const { test, expect } = require("@playwright/test");

function mockState() {
  return {
    phase: "active",
    turnPhase: "fortify",
    players: [
      {
        id: "p1",
        name: "alice",
        color: "#e85d04",
        connected: true,
        isAi: false,
        territoryCount: 3,
        eliminated: false,
        cardCount: 0
      },
      {
        id: "p2",
        name: "CPU",
        color: "#0f4c5c",
        connected: true,
        isAi: true,
        territoryCount: 0,
        eliminated: false,
        cardCount: 0
      }
    ],
    map: [
      {
        id: "cinder",
        name: "Cinder",
        neighbors: ["aurora", "delta", "ember"],
        continentId: "central",
        ownerId: "p1",
        armies: 4
      },
      {
        id: "delta",
        name: "Delta",
        neighbors: ["aurora", "cinder", "grove", "harbor"],
        continentId: "central",
        ownerId: "p1",
        armies: 2
      },
      {
        id: "harbor",
        name: "Harbor",
        neighbors: ["delta", "ember", "forge", "grove", "ion"],
        continentId: "south",
        ownerId: "p1",
        armies: 3
      }
    ],
    continents: [],
    currentPlayerId: "p1",
    reinforcementPool: 0,
    winnerId: null,
    gameConfig: {
      mapId: "classic-mini",
      mapName: "Classic Mini",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    },
    log: ["Fortify map selection test"],
    lastAction: null,
    lastCombat: null,
    pendingConquest: null,
    fortifyUsed: false,
    conqueredTerritoryThisTurn: false,
    diceRuleSet: { id: "standard", attackerMaxDice: 3, defenderMaxDice: 2 },
    cardState: {
      ruleSetId: "standard",
      tradeCount: 0,
      deckCount: 5,
      discardCount: 0,
      nextTradeBonus: 4,
      maxHandBeforeForcedTrade: 5,
      currentPlayerMustTrade: false
    },
    gameId: "g-1",
    version: 4,
    gameName: "Fortify Map Selection",
    playerId: "p1",
    playerHand: []
  };
}

test("fortify map clicks select origin first and destination second", async ({ page }) => {
  const currentState = mockState();

  await page.setViewportSize({ width: 1366, height: 600 });

  await page.addInitScript(() => {
    window.localStorage.setItem("frontline-player-id", "p1");
    window.localStorage.setItem("netrisk.theme", "war-table");
  });

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      json: { user: { id: "u1", username: "alice", role: "user", authMethods: ["password"] } }
    });
  });

  await page.route("**/api/games**", async (route) => {
    await route.fulfill({
      json: {
        games: [
          {
            id: "g-1",
            name: "Fortify Map Selection",
            updatedAt: "2026-04-12T10:00:00.000Z",
            phase: "active",
            playerCount: 2
          }
        ],
        activeGameId: "g-1"
      }
    });
  });

  await page.route("**/api/state**", async (route) => {
    await route.fulfill({ json: currentState });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: ""
    });
  });

  await page.goto("/game");

  await expect(page.locator("#fortify-group")).toBeVisible();
  await expect(page.locator("#fortify-from")).toHaveValue("cinder");
  await expect(page.locator("#fortify-to")).toHaveValue("delta");

  const dockMetrics = await page.evaluate(() => {
    const dock = document.querySelector(".game-command-dock");
    if (!dock) {
      return null;
    }

    const dockRect = dock.getBoundingClientRect();
    const visibleControls = Array.from(dock.querySelectorAll("button, select, input"))
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    return {
      controlsInsideDock: visibleControls.every(
        (rect) =>
          rect.left >= dockRect.left - 1 &&
          rect.right <= dockRect.right + 1 &&
          rect.top >= dockRect.top - 1 &&
          rect.bottom <= dockRect.bottom + 1
      ),
      dockInsideViewport:
        dockRect.left >= -1 &&
        dockRect.right <= window.innerWidth + 1 &&
        dockRect.bottom <= window.innerHeight + 1,
      contentFitsDock: dock.scrollHeight <= dock.clientHeight + 1
    };
  });

  expect(dockMetrics).not.toBeNull();
  expect(dockMetrics.dockInsideViewport).toBeTruthy();
  expect(dockMetrics.controlsInsideDock).toBeTruthy();
  expect(dockMetrics.contentFitsDock).toBeTruthy();

  await page.locator('[data-territory-id="delta"]').click();
  await expect(page.locator("#fortify-from")).toHaveValue("delta");
  await expect(page.locator("#fortify-to")).toHaveValue("cinder");
  await expect(page.locator('[data-territory-id="delta"]')).toHaveClass(/is-source/);

  await page.locator('[data-territory-id="harbor"]').click();
  await expect(page.locator("#fortify-from")).toHaveValue("delta");
  await expect(page.locator("#fortify-to")).toHaveValue("harbor");
  await expect(page.locator('[data-territory-id="harbor"]')).toHaveClass(/is-target/);
});
