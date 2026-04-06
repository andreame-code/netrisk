const { test, expect } = require("@playwright/test");

function mockState() {
  return {
    phase: "active",
    turnPhase: "attack",
    players: [
      { id: "p1", name: "alice", color: "#e85d04", connected: true, isAi: false, territoryCount: 2, eliminated: false, cardCount: 0 },
      { id: "p2", name: "CPU", color: "#0f4c5c", connected: true, isAi: true, territoryCount: 1, eliminated: false, cardCount: 0 }
    ],
    map: [
      { id: "aurora", name: "Aurora", neighbors: ["bastion"], continentId: "north", ownerId: "p1", armies: 4 },
      { id: "cinder", name: "Cinder", neighbors: ["bastion"], continentId: "north", ownerId: "p1", armies: 2 },
      { id: "bastion", name: "Bastion", neighbors: ["aurora", "cinder"], continentId: "north", ownerId: "p2", armies: 2 }
    ],
    continents: [],
    currentPlayerId: "p1",
    reinforcementPool: 0,
    winnerId: null,
    gameConfig: { mapId: "classic-mini", mapName: "Classic Mini", totalPlayers: 2, players: [{ type: "human" }, { type: "ai" }] },
    log: ["Attack dice request test"],
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
    gameName: "Attack Dice Match",
    playerId: "p1",
    playerHand: []
  };
}

test("attack UI sends the selected dice count to the backend", async ({ page }) => {
  const currentState = mockState();
  let capturedAttackDice = null;

  await page.addInitScript(() => {
    window.localStorage.setItem("frontline-player-id", "p1");
  });

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({ json: { user: { id: "u1", username: "alice", role: "user", authMethods: ["password"] } } });
  });

  await page.route("**/api/games**", async (route) => {
    await route.fulfill({ json: { games: [{ id: "g-1", name: "Attack Dice Match", updatedAt: "2026-04-02T10:00:00.000Z", phase: "active", playerCount: 2 }], activeGameId: "g-1" } });
  });

  await page.route("**/api/state**", async (route) => {
    await route.fulfill({ json: currentState });
  });

  await page.route("**/api/action", async (route) => {
    const body = route.request().postDataJSON();
    capturedAttackDice = body.attackDice;
    currentState.lastAction = { type: "attack", summary: "Aurora attacks Bastion." };
    currentState.lastCombat = {
      diceRuleSetId: "standard",
      fromTerritoryId: "aurora",
      toTerritoryId: "bastion",
      attackerPlayerId: "p1",
      defenderPlayerId: "p2",
      attackDiceCount: body.attackDice,
      defendDiceCount: 2,
      attackerRolls: [6, 5].slice(0, body.attackDice),
      defenderRolls: [4, 2],
      comparisons: Array.from({ length: Math.min(body.attackDice, 2) }, (_, index) => ({
        attacker: [6, 5, 4][index],
        defender: [4, 2][index],
        winner: "attacker"
      })),
      attackerArmiesBefore: 4,
      defenderArmiesBefore: 2,
      attackerArmiesRemaining: 3,
      defenderArmiesRemaining: 1,
      defenderReducedToZero: false,
      conqueredTerritory: false
    };
    await route.fulfill({ json: { ok: true, state: currentState } });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: "" });
  });

  await page.goto("/game.html");

  await expect(page.locator("#attack-group")).toBeVisible();
  await page.locator("#attack-from").selectOption("aurora");
  await page.locator("#attack-to").selectOption("bastion");
  await page.locator("#attack-dice").selectOption("2");
  await page.locator("#attack-button").click();

  expect(capturedAttackDice).toBe(2);
  await expect(page.locator("#combat-attacker-rolls")).toContainText("6 · 5");
});
