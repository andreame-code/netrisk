const { test, expect } = require("@playwright/test");

function mockState({ playerHand, reinforcementPool = 3, mustTrade = false }) {
  return {
    phase: "active",
    turnPhase: "reinforcement",
    players: [
      { id: "p1", name: "alice", color: "#e85d04", connected: true, isAi: false, territoryCount: 3, eliminated: false, cardCount: playerHand.length },
      { id: "p2", name: "CPU", color: "#0f4c5c", connected: true, isAi: true, territoryCount: 2, eliminated: false, cardCount: 0 }
    ],
    map: [
      { id: "aurora", name: "Aurora", neighbors: ["bastion"], continentId: "north", ownerId: "p1", armies: 3 },
      { id: "bastion", name: "Bastion", neighbors: ["aurora"], continentId: "north", ownerId: "p2", armies: 1 }
    ],
    continents: [],
    currentPlayerId: "p1",
    reinforcementPool,
    winnerId: null,
    gameConfig: { mapId: "classic-mini", mapName: "Classic Mini", totalPlayers: 2, players: [{ type: "human" }, { type: "ai" }] },
    log: ["Trade success test"],
    lastAction: null,
    pendingConquest: null,
    fortifyUsed: false,
    conqueredTerritoryThisTurn: false,
    cardState: {
      ruleSetId: "standard",
      tradeCount: 0,
      deckCount: 5,
      discardCount: 0,
      maxHandBeforeForcedTrade: 5,
      currentPlayerMustTrade: mustTrade
    },
    gameId: "g-1",
    version: 4,
    gameName: "Trade Success Match",
    playerId: "p1",
    playerHand
  };
}

test("game page shows inline success after a valid trade and clears it on reselection", async ({ page }) => {
  let currentState = mockState({
    playerHand: [
      { id: "c1", type: "infantry", territoryId: "aurora" },
      { id: "c2", type: "infantry", territoryId: "bastion" },
      { id: "c3", type: "infantry", territoryId: "aurora" },
      { id: "c4", type: "wild" }
    ],
    mustTrade: true
  });

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({ json: { user: { id: "u1", username: "alice", role: "user", authMethods: ["password"] } } });
  });

  await page.route("**/api/games**", async (route) => {
    await route.fulfill({ json: { games: [{ id: "g-1", name: "Trade Success Match", updatedAt: "2026-03-19T10:00:00.000Z", status: "active", playerCount: 2 }], activeGameId: "g-1" } });
  });

  await page.route("**/api/state**", async (route) => {
    await route.fulfill({ json: currentState });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: "" });
  });

  await page.route("**/api/cards/trade", async (route) => {
    currentState = mockState({
      playerHand: [{ id: "c4", type: "wild" }],
      reinforcementPool: 7,
      mustTrade: false
    });
    await route.fulfill({ json: { ok: true, bonus: 4, state: { ...currentState } } });
  });

  await page.goto("/game.html");

  await page.locator('[data-card-id="c1"]').click();
  await page.locator('[data-card-id="c2"]').click();
  await page.locator('[data-card-id="c3"]').click();
  await page.locator('#card-trade-button').click();

  await expect(page.locator('#card-trade-success')).toBeVisible();
  await expect(page.locator('#card-trade-success')).toContainText('Set valido: +4 rinforzi.');

  await page.locator('[data-card-id="c4"]').click();
  await expect(page.locator('#card-trade-success')).toBeHidden();
});

