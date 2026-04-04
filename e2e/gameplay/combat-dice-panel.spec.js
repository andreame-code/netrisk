const { test, expect } = require("@playwright/test");

function mockState() {
  return {
    phase: "active",
    turnPhase: "attack",
    players: [
      { id: "p1", name: "alice", color: "#e85d04", connected: true, isAi: false, territoryCount: 3, eliminated: false, cardCount: 0 },
      { id: "p2", name: "CPU", color: "#0f4c5c", connected: true, isAi: true, territoryCount: 2, eliminated: false, cardCount: 0 }
    ],
    map: [
      { id: "aurora", name: "Aurora", neighbors: ["bastion"], continentId: "north", ownerId: "p1", armies: 2 },
      { id: "bastion", name: "Bastion", neighbors: ["aurora"], continentId: "north", ownerId: "p2", armies: 0 }
    ],
    continents: [],
    currentPlayerId: "p1",
    reinforcementPool: 0,
    winnerId: null,
    gameConfig: { mapId: "classic-mini", mapName: "Classic Mini", totalPlayers: 2, players: [{ type: "human" }, { type: "ai" }] },
    log: ["alice attacca bastion"],
    lastAction: {
      type: "attack",
      summary: "alice attacca bastion: 6 contro 1. alice conquista bastion e deve spostare armate.",
      fromId: "aurora",
      toId: "bastion",
      combat: {
        diceRuleSetId: "standard",
        fromTerritoryId: "aurora",
        toTerritoryId: "bastion",
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        attackDiceCount: 3,
        defendDiceCount: 2,
        attackerRolls: [6, 5, 4],
        defenderRolls: [6, 5],
        comparisons: [
          { pair: 1, attackDie: 6, defendDie: 6, winner: "defender" },
          { pair: 2, attackDie: 5, defendDie: 5, winner: "defender" }
        ],
        attackerArmiesBefore: 3,
        defenderArmiesBefore: 1,
        attackerArmiesRemaining: 2,
        defenderArmiesRemaining: 0,
        defenderReducedToZero: true,
        conqueredTerritory: true
      }
    },
    lastCombat: {
      diceRuleSetId: "standard",
      fromTerritoryId: "aurora",
      toTerritoryId: "bastion",
      attackerPlayerId: "p1",
      defenderPlayerId: "p2",
      attackDiceCount: 3,
      defendDiceCount: 2,
      attackerRolls: [6, 5, 4],
      defenderRolls: [6, 5],
      comparisons: [
        { pair: 1, attackDie: 6, defendDie: 6, winner: "defender" },
        { pair: 2, attackDie: 5, defendDie: 5, winner: "defender" }
      ],
      attackerArmiesBefore: 3,
      defenderArmiesBefore: 1,
      attackerArmiesRemaining: 2,
      defenderArmiesRemaining: 0,
      defenderReducedToZero: true,
      conqueredTerritory: true
    },
    pendingConquest: { fromId: "aurora", toId: "bastion", minArmies: 1, maxArmies: 1 },
    fortifyUsed: false,
    conqueredTerritoryThisTurn: true,
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
    gameName: "Combat Match",
    playerId: "p1",
    playerHand: []
  };
}

test("game page shows the latest combat dice result from public state", async ({ page }) => {
  const currentState = mockState();

  await page.addInitScript(() => {
    window.localStorage.setItem("frontline-player-id", "p1");
  });

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({ json: { user: { id: "u1", username: "alice", role: "user", authMethods: ["password"] } } });
  });

  await page.route("**/api/games", async (route) => {
    await route.fulfill({ json: { games: [{ id: "g-1", name: "Combat Match", updatedAt: "2026-03-19T10:00:00.000Z", phase: "active", playerCount: 2 }], activeGameId: "g-1" } });
  });

  await page.route("**/api/state", async (route) => {
    await route.fulfill({ json: currentState });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: "" });
  });

  await page.goto("/game.html");

  await expect(page.locator("#combat-result-group")).toBeVisible();
  await expect(page.locator("#combat-result-summary")).toContainText("Aurora -> Bastion");
  await expect(page.locator("#combat-attacker-rolls")).toContainText("6 · 5 · 4");
  await expect(page.locator("#combat-defender-rolls")).toContainText("6 · 5");
  await expect(page.locator("#combat-comparisons")).toContainText("D · D");
  await expect(page.locator("#combat-result-badge")).toContainText("Territorio conquistato");

  const hasHorizontalOverflow = await page.locator("#combat-result-group").evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
});
