const { test, expect } = require("@playwright/test");

function mockState({
  playerHand,
  reinforcementPool = 3,
  mustTrade = false,
  maxHandBeforeForcedTrade = 5
}) {
  return {
    phase: "active",
    turnPhase: "reinforcement",
    players: [
      {
        id: "p1",
        name: "alice",
        color: "#e85d04",
        connected: true,
        isAi: false,
        territoryCount: 3,
        eliminated: false,
        cardCount: playerHand.length
      },
      {
        id: "p2",
        name: "CPU",
        color: "#0f4c5c",
        connected: true,
        isAi: true,
        territoryCount: 2,
        eliminated: false,
        cardCount: 0
      }
    ],
    map: [
      {
        id: "aurora",
        name: "Aurora",
        neighbors: ["bastion"],
        continentId: "north",
        ownerId: "p1",
        armies: 3
      },
      {
        id: "bastion",
        name: "Bastion",
        neighbors: ["aurora"],
        continentId: "north",
        ownerId: "p2",
        armies: 1
      }
    ],
    continents: [],
    currentPlayerId: "p1",
    reinforcementPool,
    winnerId: null,
    gameConfig: {
      mapId: "classic-mini",
      mapName: "Classic Mini",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    },
    log: ["Trade test"],
    lastAction: null,
    pendingConquest: null,
    fortifyUsed: false,
    conqueredTerritoryThisTurn: false,
    cardState: {
      ruleSetId: "standard",
      tradeCount: 0,
      deckCount: 5,
      discardCount: 0,
      nextTradeBonus: 4,
      maxHandBeforeForcedTrade,
      currentPlayerMustTrade: mustTrade
    },
    gameId: "g-1",
    version: 4,
    gameName: "Trade Match",
    playerId: "p1",
    playerHand
  };
}

test("game page lets the authenticated player select 3 cards and submit a trade", async ({
  page
}) => {
  let currentState = mockState({
    playerHand: [
      { id: "c1", type: "infantry", territoryId: "aurora" },
      { id: "c2", type: "infantry", territoryId: "bastion" },
      { id: "c3", type: "infantry", territoryId: "aurora" },
      { id: "c4", type: "wild" }
    ],
    mustTrade: true,
    maxHandBeforeForcedTrade: 7
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
            name: "Trade Match",
            updatedAt: "2026-03-19T10:00:00.000Z",
            phase: "active",
            playerCount: 2,
            totalPlayers: 2
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

  await page.route("**/api/cards/trade", async (route) => {
    const payload = route.request().postDataJSON();
    expect(payload.cardIds).toEqual(["c1", "c2", "c3"]);
    currentState = mockState({
      playerHand: [{ id: "c4", type: "wild" }],
      reinforcementPool: 7,
      mustTrade: false
    });
    await route.fulfill({ json: { ok: true, bonus: 4, state: { ...currentState } } });
  });

  await page.goto("/game");
  await expect(page.locator("#game-status")).toContainText("Trade Match", { timeout: 15000 });

  await expect(page.locator("#trade-alert")).toBeVisible();
  await expect(page.locator("#trade-alert")).toContainText("Scambio obbligatorio");
  await expect(page.locator("#trade-alert")).toContainText("scambiane 3 per continuare");
  await expect(page.locator('[data-testid="actions-panel"] #card-trade-list')).toHaveCount(0);
  await expect(page.locator("#card-trade-dock-list [data-dock-card-id]")).toHaveCount(4);
  await expect(page.locator("#card-trade-dock-help")).toContainText(
    "Scegli tre carte dalla tua mano"
  );
  await expect(page.locator("#card-trade-dock-button")).toBeDisabled();

  await page.locator('[data-dock-card-id="c1"]').click();
  await page.locator('[data-dock-card-id="c2"]').click();
  await page.locator('[data-dock-card-id="c3"]').click();

  await expect(page.locator("#card-trade-dock-button")).toBeEnabled();
  await page.locator("#card-trade-dock-button").click();

  await expect(page.locator("#status-summary")).toContainText("7");
  await page.locator(".game-cards-drawer summary").click();
  await expect(page.locator("#card-trade-list [data-card-id]")).toHaveCount(1);
  await expect(page.locator("#card-trade-help")).toContainText("0/3 carte selezionate");
});

for (const viewport of [
  { name: "short desktop", width: 1366, height: 600 },
  { name: "mobile", width: 390, height: 844 }
]) {
  test(`mandatory trade dock keeps the map clear at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const currentState = mockState({
      playerHand: [
        { id: "c1", type: "infantry", territoryId: "aurora" },
        { id: "c2", type: "infantry", territoryId: "bastion" },
        { id: "c3", type: "infantry", territoryId: "aurora" },
        { id: "c4", type: "wild" },
        { id: "c5", type: "cavalry", territoryId: "bastion" },
        { id: "c6", type: "artillery", territoryId: "aurora" },
        { id: "c7", type: "infantry", territoryId: "bastion" },
        { id: "c8", type: "wild" }
      ],
      mustTrade: true
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
              name: "Trade Match",
              updatedAt: "2026-03-19T10:00:00.000Z",
              phase: "active",
              playerCount: 2,
              totalPlayers: 2
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

    await page.addInitScript(() => window.localStorage.setItem("netrisk.theme", "war-table"));
    await page.goto("/game");

    await expect(page.locator(".game-command-dock-mandatory-trade")).toBeVisible({
      timeout: 15000
    });
    await expect(page.locator("#card-trade-dock-list [data-dock-card-id]")).toHaveCount(8);
    const firstCard = page.locator('[data-dock-card-id="c1"]');
    const firstCardBoxBefore = await firstCard.boundingBox();
    await firstCard.click();
    await expect(firstCard).toHaveAttribute("aria-pressed", "true");
    const firstCardBoxAfter = await firstCard.boundingBox();

    const metrics = await page.evaluate(() => {
      const intersects = (first, second) =>
        !(
          first.right <= second.left ||
          second.right <= first.left ||
          first.bottom <= second.top ||
          second.bottom <= first.top
        );
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

      const board = boundsFor(".game-map-stage .map-board");
      const dock = boundsFor(".game-command-dock-mandatory-trade");
      const tray = boundsFor(".game-card-tray");
      const bonus = boundsFor(".game-exchange-bonus");
      const scrollContainer = document.querySelector(".game-card-tray-scroll");
      const row = document.querySelector("#card-trade-dock-list");
      const cards = Array.from(document.querySelectorAll("[data-dock-card-id]"));
      const cardRects = cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width
        };
      });
      const adjacentGaps = cardRects
        .slice(1)
        .map((rect, index) => rect.left - cardRects[index].right);
      const cardPairsOverlap = cardRects.some((rect, index) =>
        cardRects.slice(index + 1).some((other) => intersects(rect, other))
      );
      const selectedCount = document.querySelectorAll(
        '[data-dock-card-id][aria-pressed="true"]'
      ).length;
      const stage = document.querySelector(".game-map-stage");
      const stageStyles = stage ? window.getComputedStyle(stage) : null;
      const scrollStyles = scrollContainer ? window.getComputedStyle(scrollContainer) : null;
      const rowStyles = row ? window.getComputedStyle(row) : null;
      const viewport = { height: window.innerHeight, width: window.innerWidth };

      return {
        adjacentGaps,
        boardClearOfDock: !intersects(board, dock),
        boardHeight: board.height,
        boardInsideViewport:
          board.top >= -1 &&
          board.left >= -1 &&
          board.right <= viewport.width + 1 &&
          board.bottom <= viewport.height + 1,
        boardWidth: board.width,
        bonusRightAligned: bonus.left >= tray.right - 1,
        cardPairsOverlap,
        cardWidths: cardRects.map((rect) => Math.round(rect.width)),
        dockInsideViewport:
          dock.left >= -1 && dock.right <= viewport.width + 1 && dock.bottom <= viewport.height + 1,
        rowDisplay: rowStyles?.display || "",
        rowFlexWrap: rowStyles?.flexWrap || "",
        safeBottom: stageStyles?.getPropertyValue("--game-map-safe-bottom").trim() || "",
        safeTop: stageStyles?.getPropertyValue("--game-map-safe-top").trim() || "",
        scrollHasHorizontalOverflow: scrollContainer
          ? scrollContainer.scrollWidth > scrollContainer.clientWidth
          : false,
        scrollOverflowX: scrollStyles?.overflowX || "",
        scrollOverflowY: scrollStyles?.overflowY || "",
        selectedCount,
        trayVerticalScrollFree: scrollContainer
          ? scrollContainer.scrollHeight <= scrollContainer.clientHeight + 16
          : false
      };
    });

    expect(metrics.boardWidth).toBeGreaterThan(240);
    expect(metrics.boardHeight).toBeGreaterThan(150);
    expect(metrics.boardInsideViewport).toBeTruthy();
    expect(metrics.boardClearOfDock).toBeTruthy();
    expect(metrics.dockInsideViewport).toBeTruthy();
    expect(metrics.safeBottom).toMatch(/^[0-9.]+px$/);
    expect(metrics.rowDisplay).toBe("flex");
    expect(metrics.rowFlexWrap).toBe("nowrap");
    expect(metrics.scrollOverflowX).toBe("auto");
    expect(metrics.scrollOverflowY).toBe("hidden");
    expect(metrics.scrollHasHorizontalOverflow).toBeTruthy();
    expect(metrics.trayVerticalScrollFree).toBeTruthy();
    expect(metrics.cardPairsOverlap).toBeFalsy();
    expect(Math.min(...metrics.adjacentGaps)).toBeGreaterThanOrEqual(12);
    expect(new Set(metrics.cardWidths).size).toBe(1);
    expect(firstCardBoxBefore).not.toBeNull();
    expect(firstCardBoxAfter).not.toBeNull();
    expect(Math.abs((firstCardBoxBefore?.x || 0) - (firstCardBoxAfter?.x || 0))).toBeLessThan(0.5);
    expect(Math.abs((firstCardBoxBefore?.y || 0) - (firstCardBoxAfter?.y || 0))).toBeLessThan(0.5);
    expect(
      Math.abs((firstCardBoxBefore?.width || 0) - (firstCardBoxAfter?.width || 0))
    ).toBeLessThan(0.5);
    expect(
      Math.abs((firstCardBoxBefore?.height || 0) - (firstCardBoxAfter?.height || 0))
    ).toBeLessThan(0.5);
    expect(metrics.selectedCount).toBe(1);
    expect(metrics.bonusRightAligned).toBeTruthy();
  });
}
