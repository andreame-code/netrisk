const { test, expect } = require("@playwright/test");

const {
  attachSessionCookie,
  findAttackPair,
  getReinforcementCount,
  queueNextAttackRolls,
  resetGame,
  uniqueUser
} = require("../support/game-helpers");

async function createAuthenticatedSession(page, username, password = "secret123") {
  const registerResponse = await page.request.post("/api/auth/register", {
    data: { username, password }
  });
  await expect(registerResponse.ok()).toBeTruthy();

  const loginResponse = await page.request.post("/api/auth/login", {
    data: { username, password }
  });
  await expect(loginResponse.ok()).toBeTruthy();

  const sessionToken = loginResponse.headers()["set-cookie"]?.match(/netrisk_session=([^;]+)/)?.[1];
  expect(sessionToken).toBeTruthy();

  return sessionToken;
}

async function createGame(page, sessionToken, payload) {
  const response = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` },
    data: payload
  });
  await expect(response.ok()).toBeTruthy();
  return response.json();
}

async function joinGame(page, sessionToken, gameId) {
  const response = await page.request.post("/api/join", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` },
    data: { gameId }
  });
  await expect(response.ok()).toBeTruthy();
  return response.json();
}

function mockTradeState({ playerHand, reinforcementPool = 3, mustTrade = false }) {
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
        armies: 3,
        x: 0.2,
        y: 0.3
      },
      {
        id: "bastion",
        name: "Bastion",
        neighbors: ["aurora"],
        continentId: "north",
        ownerId: "p2",
        armies: 1,
        x: 0.65,
        y: 0.45
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
    log: ["Trade React gameplay test"],
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
      maxHandBeforeForcedTrade: 5,
      currentPlayerMustTrade: mustTrade
    },
    gameId: "g-1",
    version: 4,
    gameName: "React Trade Match",
    playerId: "p1",
    playerHand
  };
}

test("react gameplay deep links support the core turn flow and the legacy fallback", async ({
  browser
}) => {
  test.slow();

  const ownerContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const joinerPage = await joinerContext.newPage();

  await resetGame(ownerPage);

  const ownerUsername = uniqueUser("rsh_game_owner");
  const joinerUsername = uniqueUser("rsh_game_joiner");
  const ownerSession = await createAuthenticatedSession(ownerPage, ownerUsername);
  const joinerSession = await createAuthenticatedSession(joinerPage, joinerUsername);

  const createdGame = await createGame(ownerPage, ownerSession, {
    name: uniqueUser("react_gameplay"),
    totalPlayers: 2,
    players: [
      { slot: 1, type: "human" },
      { slot: 2, type: "human" }
    ]
  });
  await joinGame(joinerPage, joinerSession, createdGame.game.id);

  await attachSessionCookie(ownerPage, ownerSession);
  await attachSessionCookie(joinerPage, joinerSession);

  await ownerPage.goto(`/react/game/${createdGame.game.id}`);
  await joinerPage.goto(`/react/game/${createdGame.game.id}`);

  await expect(ownerPage.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(joinerPage.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(ownerPage.getByText(createdGame.game.name)).toBeVisible();
  await expect(ownerPage.getByRole("button", { name: "Avvia partita" })).toBeVisible();

  await ownerPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(ownerPage.getByTestId("phase-indicator")).not.toContainText(/Lobby/i, {
    timeout: 15000
  });

  const displayedOwnerName = (await ownerPage.getByTestId("current-player-indicator").innerText()).trim();
  const attackPair = await findAttackPair(ownerPage, displayedOwnerName);
  const reinforceButton = ownerPage.getByRole("button", { name: "Aggiungi" });

  for (;;) {
    const reinforcementCount = await getReinforcementCount(ownerPage);
    if (reinforcementCount <= 0) {
      break;
    }

    await reinforceButton.click();
  }

  await expect(ownerPage.getByTestId("status-summary")).toContainText(
    /Rinforzi disponibili:\s*0/i
  );
  await ownerPage.locator("#attack-from").selectOption(attackPair.fromId);
  await ownerPage.locator("#attack-to").selectOption(attackPair.toId);
  await ownerPage.locator("#attack-dice").selectOption("1");
  await queueNextAttackRolls(ownerPage, 6, 1);
  await ownerPage.getByRole("button", { name: "Lancia attacco" }).click();

  await expect(ownerPage.locator("#conquest-group")).toBeVisible();
  await ownerPage.locator("#conquest-armies").fill("1");
  await ownerPage.getByRole("button", { name: "Sposta armate" }).click();

  await ownerPage.locator("#end-turn-button").click();
  await expect(ownerPage.locator("#fortify-group")).toBeVisible();
  await expect(ownerPage.locator("#end-turn-button")).toHaveText("Termina turno");

  await ownerPage.locator("#fortify-from").selectOption(attackPair.fromId);
  await ownerPage.locator("#fortify-to").selectOption(attackPair.toId);
  await ownerPage.locator("#fortify-armies").fill("1");
  await ownerPage.locator("#fortify-button").click();

  await expect(ownerPage.locator("#fortify-button")).toBeDisabled();
  await expect(
    ownerPage.locator(`[data-territory-id="${attackPair.toId}"] .territory-armies`)
  ).toHaveText("2");

  await ownerPage.locator("#end-turn-button").click();

  await expect(joinerPage.getByTestId("status-summary")).toContainText(
    /Rinforzi disponibili:\s*[1-9]\d*/i,
    { timeout: 15000 }
  );
  await expect(joinerPage.getByRole("button", { name: "Aggiungi" })).toBeEnabled();
  await expect(ownerPage.locator("#end-turn-button")).toBeHidden({ timeout: 15000 });

  await ownerPage.getByRole("link", { name: "Legacy fallback" }).click();
  await expect.poll(() => ownerPage.url(), { timeout: 15000 }).toMatch(
    new RegExp(`/game/${createdGame.game.id}$`)
  );
  await expect(ownerPage.locator("#game-status")).toContainText(createdGame.game.name, {
    timeout: 15000
  });

  await ownerContext.close();
  await joinerContext.close();
});

test("react gameplay handles the forced trade flow on the React route", async ({ page }) => {
  let currentState = mockTradeState({
    playerHand: [
      { id: "c1", type: "infantry", territoryId: "aurora" },
      { id: "c2", type: "infantry", territoryId: "bastion" },
      { id: "c3", type: "infantry", territoryId: "aurora" },
      { id: "c4", type: "wild" }
    ],
    mustTrade: true
  });

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      json: {
        user: { id: "u1", username: "alice", role: "user", authMethods: ["password"] }
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

    currentState = mockTradeState({
      playerHand: [{ id: "c4", type: "wild" }],
      reinforcementPool: 7,
      mustTrade: false
    });

    await route.fulfill({ json: { ok: true, bonus: 4, state: { ...currentState } } });
  });

  await page.goto("/react/game/g-1");

  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(page.locator("#trade-alert")).toBeVisible();
  await expect(page.locator("#card-trade-group")).toBeVisible();
  await expect(page.locator("#card-trade-alert")).toContainText(
    /Devi scambiare subito 3 carte/i
  );
  await expect(page.locator("#card-trade-list [data-card-id]")).toHaveCount(4);
  await expect(page.locator("#card-trade-button")).toBeDisabled();

  await page.locator('[data-card-id="c1"]').click();
  await page.locator('[data-card-id="c2"]').click();
  await page.locator('[data-card-id="c3"]').click();

  await expect(page.locator("#card-trade-button")).toBeEnabled();
  await page.locator("#card-trade-button").click();

  await expect(page.getByTestId("status-summary")).toContainText("7");
  await expect(page.locator("#card-trade-list [data-card-id]")).toHaveCount(1);
  await expect(page.locator("#card-trade-help")).toContainText("0/3 carte selezionate");
  await expect(page.getByTestId("react-shell-game-feedback")).toContainText(
    /Set valido|Valid set/
  );
});

test("react gameplay recovers from VERSION_CONFLICT by refreshing the snapshot and continuing the turn", async ({
  page
}) => {
  function buildGameplayState(overrides = {}) {
    const baseState = {
      phase: "active",
      turnPhase: "reinforcement",
      players: [
        {
          id: "p1",
          name: "alice",
          color: "#e85d04",
          connected: true,
          isAi: false,
          territoryCount: 1,
          eliminated: false,
          cardCount: 0
        },
        {
          id: "p2",
          name: "CPU",
          color: "#0f4c5c",
          connected: true,
          isAi: true,
          territoryCount: 1,
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
          armies: 3,
          x: 0.2,
          y: 0.3
        },
        {
          id: "bastion",
          name: "Bastion",
          neighbors: ["aurora"],
          continentId: "north",
          ownerId: "p2",
          armies: 1,
          x: 0.65,
          y: 0.45
        }
      ],
      continents: [],
      currentPlayerId: "p1",
      reinforcementPool: 1,
      winnerId: null,
      gameConfig: {
        mapId: "classic-mini",
        mapName: "Classic Mini",
        totalPlayers: 2,
        players: [{ type: "human" }, { type: "ai" }]
      },
      log: ["Version conflict recovery"],
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
        maxHandBeforeForcedTrade: 5,
        currentPlayerMustTrade: false
      },
      diceRuleSet: {
        id: "standard",
        attackerMaxDice: 3,
        defenderMaxDice: 2
      },
      attacksThisTurn: 0,
      gameId: "g-conflict",
      version: 4,
      gameName: "Conflict Match",
      playerId: "p1",
      playerHand: []
    };

    return {
      ...baseState,
      ...overrides,
      players: overrides.players || baseState.players,
      map: overrides.map || baseState.map,
      gameConfig: overrides.gameConfig || baseState.gameConfig,
      cardState: {
        ...baseState.cardState,
        ...(overrides.cardState || {})
      },
      diceRuleSet: {
        ...baseState.diceRuleSet,
        ...(overrides.diceRuleSet || {})
      },
      playerHand: Object.prototype.hasOwnProperty.call(overrides, "playerHand")
        ? overrides.playerHand
        : baseState.playerHand,
      log: Object.prototype.hasOwnProperty.call(overrides, "log") ? overrides.log : baseState.log,
      pendingConquest: Object.prototype.hasOwnProperty.call(overrides, "pendingConquest")
        ? overrides.pendingConquest
        : baseState.pendingConquest
    };
  }

  let currentState = buildGameplayState();
  let actionCalls = 0;

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      json: {
        user: { id: "u1", username: "alice", role: "user", authMethods: ["password"] }
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

  await page.route("**/api/action", async (route) => {
    const payload = route.request().postDataJSON();
    actionCalls += 1;

    if (actionCalls === 1) {
      expect(payload.type).toBe("reinforce");
      expect(payload.expectedVersion).toBe(4);
      expect(payload.territoryId).toBe("aurora");

      currentState = buildGameplayState({
        version: 5,
        turnPhase: "attack",
        reinforcementPool: 0,
        map: [
          {
            id: "aurora",
            name: "Aurora",
            neighbors: ["bastion"],
            continentId: "north",
            ownerId: "p1",
            armies: 4,
            x: 0.2,
            y: 0.3
          },
          {
            id: "bastion",
            name: "Bastion",
            neighbors: ["aurora"],
            continentId: "north",
            ownerId: "p2",
            armies: 1,
            x: 0.65,
            y: 0.45
          }
        ]
      });

      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.",
          code: "VERSION_CONFLICT",
          currentVersion: 5,
          state: { ...currentState }
        })
      });
      return;
    }

    expect(payload.type).toBe("attack");
    expect(payload.expectedVersion).toBe(5);
    expect(payload.fromId).toBe("aurora");
    expect(payload.toId).toBe("bastion");
    expect(payload.attackDice).toBe(1);

    currentState = buildGameplayState({
      version: 6,
      turnPhase: "attack",
      reinforcementPool: 0,
      pendingConquest: {
        fromId: "aurora",
        toId: "bastion",
        minArmies: 1,
        maxArmies: 3
      },
      lastCombat: {
        fromTerritoryId: "aurora",
        toTerritoryId: "bastion",
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        attackDiceCount: 1,
        defendDiceCount: 1,
        attackerRolls: [6],
        defenderRolls: [1],
        comparisons: [{ attackerDie: 6, defenderDie: 1, winner: "attacker" }],
        conqueredTerritory: false,
        defenderReducedToZero: true
      }
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        state: { ...currentState }
      })
    });
  });

  await page.goto("/react/game/g-conflict");

  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(page.getByTestId("status-summary")).toContainText(
    /Rinforzi disponibili:\s*1/i
  );

  await page.getByRole("button", { name: "Aggiungi" }).click();

  await expect(page.getByTestId("react-shell-game-feedback")).toContainText(
    /Ho ricaricato lo stato piu recente|reloaded the latest state/i
  );
  await expect(page.getByTestId("status-summary")).toContainText(
    /Rinforzi disponibili:\s*0/i
  );
  await expect(page.locator("#attack-group")).toBeVisible();

  await page.locator("#attack-to").selectOption("bastion");
  await page.locator("#attack-dice").selectOption("1");
  await page.getByRole("button", { name: "Lancia attacco" }).click();

  await expect(page.locator("#conquest-group")).toBeVisible();
  await expect(page.locator("#conquest-armies")).toHaveAttribute("placeholder", "1");
});
