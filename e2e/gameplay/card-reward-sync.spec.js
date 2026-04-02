const { test, expect } = require("@playwright/test");

function mockState({ playerHand, turnPhase = "fortify", currentPlayerId = "p1", reinforcementPool = 0, version = 4 }) {
  return {
    phase: "active",
    turnPhase,
    players: [
      { id: "p1", name: "alice", color: "#e85d04", connected: true, isAi: false, territoryCount: 4, eliminated: false, cardCount: playerHand.length },
      { id: "p2", name: "CPU", color: "#0f4c5c", connected: true, isAi: true, territoryCount: 2, eliminated: false, cardCount: 0 }
    ],
    map: [
      { id: "aurora", name: "Aurora", neighbors: ["bastion"], continentId: "north", ownerId: "p1", armies: 3 },
      { id: "bastion", name: "Bastion", neighbors: ["aurora"], continentId: "north", ownerId: "p2", armies: 1 }
    ],
    continents: [],
    currentPlayerId,
    reinforcementPool,
    winnerId: null,
    gameConfig: { mapId: "classic-mini", mapName: "Classic Mini", totalPlayers: 2, players: [{ type: "human" }, { type: "ai" }] },
    log: ["Reward test"],
    lastAction: null,
    pendingConquest: null,
    fortifyUsed: true,
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
    version,
    gameName: "Reward Match",
    playerId: "p1",
    playerHand
  };
}

test("game page refreshes player hand after an action updates card rewards", async ({ page }) => {
  const initialState = mockState({ playerHand: [], version: 4 });
  const refreshedState = mockState({
    playerHand: [{ id: "reward-1", type: "artillery", territoryId: "aurora" }],
    turnPhase: "reinforcement",
    currentPlayerId: "p1",
    reinforcementPool: 1,
    version: 5
  });
  let stateCalls = 0;

  await page.addInitScript(() => {
    window.localStorage.setItem("frontline-session-token", "session-test");
    window.localStorage.setItem("frontline-player-id", "p1");
  });

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({ json: { user: { id: "u1", username: "alice", role: "user", authMethods: ["password"] } } });
  });

  await page.route("**/api/games", async (route) => {
    await route.fulfill({ json: { games: [{ id: "g-1", name: "Reward Match", updatedAt: "2026-03-19T10:00:00.000Z", status: "active", playerCount: 2 }], activeGameId: "g-1" } });
  });

  await page.route("**/api/state", async (route) => {
    stateCalls += 1;
    await route.fulfill({ json: stateCalls === 1 ? initialState : refreshedState });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: "" });
  });

  await page.route("**/api/action", async (route) => {
    await route.fulfill({ json: { ok: true, state: { ...refreshedState, playerHand: [] } } });
  });

  await page.goto("/game.html");

  await expect(page.locator("#card-trade-group")).toBeHidden();
  await expect(page.locator("#end-turn-button")).toBeEnabled();
  await page.locator("#end-turn-button").click();

  await expect(page.locator("#card-trade-group")).toBeVisible();
  await expect(page.locator("#card-trade-list [data-card-id]")).toHaveCount(1);
  await expect(page.locator("#card-trade-list")).toContainText("Artiglieria");
});
