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
  await expect(page.getByTestId("status-summary")).toContainText(
    /Rinforzi disponibili:\s*[1-9]\d*/i,
    {
      timeout: 15000
    }
  );
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

async function openMockFortifyGame(page) {
  const fortifyState = {
    phase: "active",
    turnPhase: "fortify",
    players: [
      {
        id: "p1",
        name: "andrea",
        color: "#7c3aed",
        connected: true,
        isAi: false,
        territoryCount: 2,
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
        neighbors: ["alaska", "alberta"],
        continentId: "north-america",
        ownerId: "p1",
        armies: 4,
        x: 0.22,
        y: 0.38
      },
      {
        id: "alaska",
        name: "Alaska",
        neighbors: ["western-united-states"],
        continentId: "north-america",
        ownerId: "p1",
        armies: 1,
        x: 0.16,
        y: 0.18
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
    log: ["Fortify layout visual state"],
    lastAction: null,
    pendingConquest: null,
    fortifyUsed: false,
    conqueredTerritoryThisTurn: true,
    attacksThisTurn: 1,
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
    gameId: "g-mobile-fortify",
    version: 8,
    gameName: "Mobile Fortify",
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
    await route.fulfill({ json: fortifyState });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: ""
    });
  });

  await page.addInitScript(() => window.localStorage.setItem("netrisk.theme", "war-table"));
  await page.goto("/react/game/g-mobile-fortify");
  await expect(page.locator(".game-command-dock-fortify")).toBeVisible();
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

async function readMobileFortifyLayout(page) {
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
      dock: rectFor(".game-command-dock"),
      endTurn: rectFor("#end-turn-button"),
      fortify: rectFor("#fortify-button"),
      header: rectFor("body[data-app-section='game'] .top-nav-bar"),
      mobileActions: document.querySelector(".game-mobile-sheet-actions")
        ? rectFor(".game-mobile-sheet-actions")
        : null,
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
        hudDisplay: window.getComputedStyle(document.querySelector(".game-floating-hud")).display,
        mobileActions: boundsFor(".game-mobile-sheet-actions"),
        mobileActionButtons: Array.from(
          document.querySelectorAll(".game-mobile-sheet-actions button")
        ).map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            height: rect.height,
            top: rect.top
          };
        }),
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
        toggle: boundsFor(".game-command-dock-toggle"),
        title: window
          .getComputedStyle(
            document.querySelector("body[data-app-section='game'] .top-nav-title"),
            "::after"
          )
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
    expect(layout.dock.height).toBeGreaterThanOrEqual(132);
    expect(layout.dock.height).toBeLessThanOrEqual(160);
    expect(layout.sheetState).toBe("collapsed");
    expect(layout.hudDisplay).toBe("none");
    expect(layout.toggle.width).toBeLessThanOrEqual(56);
    expect(layout.toggle.right).toBeGreaterThanOrEqual(layout.viewport.width - 58);
    expect(layout.mobileActions.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
    expect(layout.mobileActionButtons).toHaveLength(4);
    for (const button of layout.mobileActionButtons) {
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.top).toBeGreaterThanOrEqual(0);
      expect(button.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
    }

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
      const mobileActionsRect = document
        .querySelector(".game-mobile-sheet-actions")
        .getBoundingClientRect();
      const reinforcementStepperControls = Array.from(
        document.querySelectorAll("#reinforce-group .game-number-stepper button, #reinforce-amount")
      ).map((control) => {
        const rect = control.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width
        };
      });
      const toggleRect = document
        .querySelector(".game-command-dock-toggle")
        .getBoundingClientRect();

      return {
        dock: {
          bottom: dockRect.bottom,
          height: dockRect.height,
          top: dockRect.top
        },
        mobileActions: {
          bottom: mobileActionsRect.bottom,
          height: mobileActionsRect.height,
          top: mobileActionsRect.top
        },
        primaryDockButton: {
          bottom: buttonRect.bottom,
          height: buttonRect.height,
          top: buttonRect.top
        },
        reinforcementStepperControls,
        toggle: {
          bottom: toggleRect.bottom,
          height: toggleRect.height,
          right: toggleRect.right,
          top: toggleRect.top,
          width: toggleRect.width
        },
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth
        }
      };
    });

    expect(halfOpenLayout.dock.height).toBeGreaterThanOrEqual(280);
    expect(halfOpenLayout.dock.height).toBeLessThanOrEqual(halfOpenLayout.viewport.height * 0.44);
    expect(halfOpenLayout.primaryDockButton.height).toBeGreaterThanOrEqual(44);
    expect(halfOpenLayout.primaryDockButton.bottom).toBeLessThanOrEqual(
      halfOpenLayout.viewport.height + 1
    );
    expect(halfOpenLayout.reinforcementStepperControls).toHaveLength(3);
    for (const control of halfOpenLayout.reinforcementStepperControls) {
      expect(control.height).toBeGreaterThanOrEqual(44);
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(halfOpenLayout.viewport.width + 1);
    }
    expect(halfOpenLayout.toggle.width).toBeLessThanOrEqual(56);
    expect(halfOpenLayout.toggle.right).toBeGreaterThanOrEqual(halfOpenLayout.viewport.width - 58);
    expect(halfOpenLayout.mobileActions.height).toBeGreaterThanOrEqual(44);
    expect(halfOpenLayout.mobileActions.bottom).toBeLessThanOrEqual(
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

async function pinchMap(
  page,
  { endCenterOffsetX = 0, endHalfDistance, pointerId, startCenterOffsetX = 0, startHalfDistance }
) {
  await page.evaluate(
    ({
      endCenterOffsetX: endOffsetX,
      endHalfDistance: endDistance,
      pointerId: firstPointerId,
      startCenterOffsetX: startOffsetX,
      startHalfDistance: startDistance
    }) => {
      const surfaceElement = document.querySelector("[data-map-surface]");
      if (!surfaceElement) {
        throw new Error("Missing map surface");
      }

      const rect = surfaceElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startCenterX = centerX + startOffsetX;
      const endCenterX = centerX + endOffsetX;
      const dispatchTouchPointer = (type, currentPointerId, clientX) => {
        surfaceElement.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
            clientX,
            clientY: centerY,
            isPrimary: currentPointerId === firstPointerId,
            pointerId: currentPointerId,
            pointerType: "touch"
          })
        );
      };

      dispatchTouchPointer("pointerdown", firstPointerId, startCenterX - startDistance);
      dispatchTouchPointer("pointerdown", firstPointerId + 1, startCenterX + startDistance);
      dispatchTouchPointer("pointermove", firstPointerId, endCenterX - endDistance);
      dispatchTouchPointer("pointermove", firstPointerId + 1, endCenterX + endDistance);
      dispatchTouchPointer("pointerup", firstPointerId, endCenterX - endDistance);
      dispatchTouchPointer("pointerup", firstPointerId + 1, endCenterX + endDistance);
    },
    {
      endCenterOffsetX,
      endHalfDistance,
      pointerId,
      startCenterOffsetX,
      startHalfDistance
    }
  );
}

async function dragMap(page, { deltaY, pointerId }) {
  await page.evaluate(
    ({ deltaY: verticalDelta, pointerId: currentPointerId }) => {
      const surfaceElement = document.querySelector("[data-map-surface]");
      if (!surfaceElement) {
        throw new Error("Missing map surface");
      }

      const rect = surfaceElement.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const startClientY = rect.top + rect.height / 2;
      const dispatchTouchPointer = (type, clientY) => {
        surfaceElement.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
            clientX,
            clientY,
            isPrimary: true,
            pointerId: currentPointerId,
            pointerType: "touch"
          })
        );
      };

      dispatchTouchPointer("pointerdown", startClientY);
      dispatchTouchPointer("pointermove", startClientY + verticalDelta);
      dispatchTouchPointer("pointerup", startClientY + verticalDelta);
    },
    { deltaY, pointerId }
  );
}

test("mobile map can fit the whole board and supports two-finger pinch zoom", async ({ page }) => {
  await page.setViewportSize(mobileViewports[0]);
  await openWorldClassicGame(page);

  for (const [viewportIndex, viewport] of mobileViewports.entries()) {
    if (viewportIndex > 0) {
      await page.setViewportSize(viewport);
      await page.reload();
      await expect(page.locator(".map-board.has-custom-background")).toBeVisible({
        timeout: 15000
      });
    }

    const surface = page.locator("[data-map-surface]");
    await expect(surface).toBeVisible();
    const initialScale = Number(await surface.getAttribute("data-map-scale"));
    const minimumScale = Number(await surface.getAttribute("data-map-min-scale"));
    expect(initialScale).toBeCloseTo(1, 3);
    expect(minimumScale).toBeGreaterThan(0);
    expect(minimumScale).toBeLessThan(1);
    await expect(page.getByRole("button", { name: "Adatta mappa alla schermata" })).toBeVisible();

    await page.locator("[data-map-control='focus']").click();
    await expect
      .poll(async () => Number(await surface.getAttribute("data-map-scale")))
      .toBeCloseTo(minimumScale, 3);

    const fittedLayout = await page.evaluate(() => {
      const surfaceElement = document.querySelector("[data-map-surface]");
      const board = document.querySelector(".game-map-stage .map-board");
      if (!surfaceElement || !board) {
        throw new Error("Missing map surface or board");
      }

      const surfaceRect = surfaceElement.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      const viewportTop = Number(surfaceElement.getAttribute("data-map-viewport-top"));
      const viewportBottom = Number(surfaceElement.getAttribute("data-map-viewport-bottom"));
      return {
        boardBottom: boardRect.bottom,
        boardHeight: boardRect.height,
        boardLeft: boardRect.left,
        boardRight: boardRect.right,
        boardTop: boardRect.top,
        surfaceBottom: surfaceRect.bottom,
        boardWidth: boardRect.width,
        surfaceHeight: surfaceRect.height,
        surfaceLeft: surfaceRect.left,
        surfaceRight: surfaceRect.right,
        surfaceSafeBottom: surfaceRect.top + viewportBottom,
        surfaceSafeTop: surfaceRect.top + viewportTop,
        surfaceTop: surfaceRect.top,
        surfaceWidth: surfaceRect.width
      };
    });
    expect(fittedLayout.boardWidth).toBeLessThanOrEqual(fittedLayout.surfaceWidth + 1);
    expect(fittedLayout.boardHeight).toBeLessThanOrEqual(fittedLayout.surfaceHeight + 1);
    expect(fittedLayout.boardLeft).toBeGreaterThanOrEqual(fittedLayout.surfaceLeft - 1);
    expect(fittedLayout.boardRight).toBeLessThanOrEqual(fittedLayout.surfaceRight + 1);
    expect(fittedLayout.boardTop).toBeGreaterThanOrEqual(fittedLayout.surfaceTop - 1);
    expect(fittedLayout.boardBottom).toBeLessThanOrEqual(fittedLayout.surfaceBottom + 1);
    expect(fittedLayout.boardTop).toBeGreaterThanOrEqual(fittedLayout.surfaceSafeTop - 1);
    expect(fittedLayout.boardBottom).toBeLessThanOrEqual(fittedLayout.surfaceSafeBottom + 1);

    const pointerId = 41 + viewportIndex * 20;
    await pinchMap(page, { endHalfDistance: 80, pointerId, startHalfDistance: 40 });
    await expect
      .poll(async () => Number(await surface.getAttribute("data-map-scale")))
      .toBeGreaterThan(minimumScale + 0.2);
    const zoomedScale = Number(await surface.getAttribute("data-map-scale"));
    const symmetricPinchTranslateX = Number(await surface.getAttribute("data-map-translate-x"));
    expect(Math.abs(symmetricPinchTranslateX)).toBeLessThanOrEqual(1);

    const beforeVerticalDrag = Number(await surface.getAttribute("data-map-translate-y"));
    await dragMap(page, { deltaY: 60, pointerId: pointerId + 2 });
    await expect
      .poll(async () => Number(await surface.getAttribute("data-map-translate-y")))
      .toBeGreaterThan(beforeVerticalDrag + 20);

    await pinchMap(page, {
      endCenterOffsetX: 30,
      endHalfDistance: 60,
      pointerId: pointerId + 4,
      startHalfDistance: 60
    });
    await expect
      .poll(async () => Number(await surface.getAttribute("data-map-scale")))
      .toBeCloseTo(zoomedScale, 3);
    await expect
      .poll(async () => Number(await surface.getAttribute("data-map-translate-x")))
      .toBeGreaterThan(symmetricPinchTranslateX + 20);

    await pinchMap(page, {
      endHalfDistance: 10,
      pointerId: pointerId + 10,
      startHalfDistance: 80
    });
    await expect
      .poll(async () => Number(await surface.getAttribute("data-map-scale")))
      .toBeLessThan(zoomedScale);
    await expect
      .poll(async () => Number(await surface.getAttribute("data-map-scale")))
      .toBeCloseTo(minimumScale, 3);
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
  await expect(page.locator(".game-mobile-sheet-actions")).toBeVisible();

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
  expect(halfOpenLayout.mobileActions.bottom).toBeLessThanOrEqual(
    halfOpenLayout.viewport.height + 1
  );

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

test("mobile fortify sheet keeps primary actions visible and expands only secondary actions", async ({
  page
}) => {
  await page.setViewportSize(mobileViewports[0]);
  await openMockFortifyGame(page);

  await page.locator(".game-command-dock-toggle").click();
  await expect(page.locator(".game-command-dock")).toHaveAttribute(
    "data-command-sheet-state",
    "half-open"
  );
  await expect(page.locator("#fortify-button")).toBeVisible();
  await expect(page.locator("#end-turn-button")).toBeVisible();
  await expect(page.locator(".game-mobile-sheet-actions")).toBeVisible();

  const halfOpenLayout = await readMobileFortifyLayout(page);
  for (const button of [halfOpenLayout.fortify, halfOpenLayout.endTurn, halfOpenLayout.toggle]) {
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.top).toBeGreaterThanOrEqual(0);
    expect(button.bottom).toBeLessThanOrEqual(halfOpenLayout.viewport.height + 1);
  }
  expect(halfOpenLayout.dock.height).toBeGreaterThanOrEqual(390);
  expect(halfOpenLayout.dock.height).toBeLessThanOrEqual(410);
  expect(halfOpenLayout.dock.top - halfOpenLayout.header.bottom).toBeGreaterThan(240);
  expect(halfOpenLayout.mobileActions.bottom).toBeLessThanOrEqual(
    halfOpenLayout.viewport.height + 1
  );

  await page.locator(".game-command-dock-toggle").click();
  await expect(page.locator(".game-command-dock")).toHaveAttribute(
    "data-command-sheet-state",
    "expanded"
  );
  await expect(page.locator(".game-mobile-sheet-actions")).toBeVisible();

  const expandedLayout = await readMobileFortifyLayout(page);
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
