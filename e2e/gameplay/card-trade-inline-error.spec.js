const { test, expect } = require("@playwright/test");

function mockState() {
  return {
    phase: "active",
    turnPhase: "reinforcement",
    players: [
      { id: "p1", name: "alice", color: "#e85d04", connected: true, isAi: false, territoryCount: 3, eliminated: false, cardCount: 3 },
      { id: "p2", name: "CPU", color: "#0f4c5c", connected: true, isAi: true, territoryCount: 2, eliminated: false, cardCount: 0 }
    ],
    map: [
      { id: "aurora", name: "Aurora", neighbors: ["bastion"], continentId: "north", ownerId: "p1", armies: 3 },
      { id: "bastion", name: "Bastion", neighbors: ["aurora"], continentId: "north", ownerId: "p2", armies: 1 }
    ],
    continents: [],
    currentPlayerId: "p1",
    reinforcementPool: 3,
    winnerId: null,
    gameConfig: { mapId: "classic-mini", mapName: "Classic Mini", totalPlayers: 2, players: [{ type: "human" }, { type: "ai" }] },
    log: ["Trade invalid test"],
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
      currentPlayerMustTrade: false
    },
    gameId: "g-1",
    version: 4,
    gameName: "Trade Invalid Match",
    playerId: "p1",
    playerHand: [
      { id: "c1", type: "infantry", territoryId: "aurora" },
      { id: "c2", type: "cavalry", territoryId: "bastion" },
      { id: "c3", type: "cavalry", territoryId: "aurora" }
    ]
  };
}

test("game page shows an inline trade error and clears it on selection change", async ({ page }) => {
  const currentState = mockState();

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({ json: { user: { id: "u1", username: "alice", role: "user", authMethods: ["password"] } } });
  });

  await page.route("**/api/games**", async (route) => {
    await route.fulfill({ json: { games: [{ id: "g-1", name: "Trade Invalid Match", updatedAt: "2026-03-19T10:00:00.000Z", status: "active", playerCount: 2 }], activeGameId: "g-1" } });
  });

  await page.route("**/api/state**", async (route) => {
    await route.fulfill({ json: currentState });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: "" });
  });

  await page.route("**/api/cards/trade", async (route) => {
    await route.fulfill({ status: 400, json: { error: "Card set does not match a valid standard trade." } });
  });

  await page.goto("/game.html");

  await page.locator('[data-card-id="c1"]').click();
  await page.locator('[data-card-id="c2"]').click();
  await page.locator('[data-card-id="c3"]').click();
  await page.locator('#card-trade-button').click();

  await expect(page.locator('#card-trade-error')).toBeVisible();
  await expect(page.locator('#card-trade-error')).toContainText('Card set does not match a valid standard trade.');

  await page.locator('[data-card-id="c3"]').click();
  await expect(page.locator('#card-trade-error')).toBeHidden();
});
