const { test, expect } = require("@playwright/test");
const {
  attachSessionCookie,
  createAuthenticatedSession,
  findAttackPair,
  getReinforcementCount,
  queueNextAttackRolls,
  resetGame,
  uniqueUser
} = require("../support/game-helpers");
const {
  expectTouchTarget,
  isCriticalMobileProject,
  nativeOneFingerPan,
  nativeTwoFingerPinch,
  revealMobileControl
} = require("../support/mobile-uat-helpers");

async function openActiveWorldGame(page) {
  await resetGame(page);
  const username = uniqueUser("mobile_map_owner");
  const sessionToken = await createAuthenticatedSession(page, username);
  const createResponse = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` },
    data: {
      name: uniqueUser("mobile_map_uat"),
      mapId: "world-classic",
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "ai" }
      ]
    }
  });
  await expect(createResponse.ok()).toBeTruthy();
  const createdGame = await createResponse.json();

  await attachSessionCookie(page, sessionToken);
  await page.goto(`/game/${createdGame.game.id}`);

  const startButton = page.getByRole("button", { name: "Avvia partita" });
  await revealMobileControl(page, startButton);
  await expectTouchTarget(startButton);
  await startButton.click();
  await expect(page.getByTestId("phase-indicator")).not.toContainText(/Lobby/i, {
    timeout: 15000
  });
  await expect(page.locator(".map-board.has-custom-background")).toBeVisible({ timeout: 15000 });
}

test("mobile map fits fully and accepts native touch pan and pinch", async ({
  browserName,
  page
}) => {
  test.slow();
  await openActiveWorldGame(page);

  const surface = page.locator("[data-map-surface]");
  const fitButton = page.locator('[data-map-control="focus"]');
  const zoomInButton = page.locator('[data-map-control="zoom-in"]');
  const zoomOutButton = page.locator('[data-map-control="zoom-out"]');
  await expectTouchTarget(fitButton);
  await expectTouchTarget(zoomInButton);
  await expectTouchTarget(zoomOutButton);

  await fitButton.tap();
  const minimumScale = Number(await surface.getAttribute("data-map-min-scale"));
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeCloseTo(minimumScale, 3);

  const fittedLayout = await page.evaluate(() => {
    const surfaceElement = document.querySelector("[data-map-surface]");
    const board = document.querySelector(".game-map-stage .map-board");
    if (!surfaceElement || !board) {
      throw new Error("Missing mobile map surface or board.");
    }
    const surfaceRect = surfaceElement.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const safeTop = surfaceRect.top + Number(surfaceElement.getAttribute("data-map-viewport-top"));
    const safeBottom =
      surfaceRect.top + Number(surfaceElement.getAttribute("data-map-viewport-bottom"));
    return {
      boardBottom: boardRect.bottom,
      boardLeft: boardRect.left,
      boardRight: boardRect.right,
      boardTop: boardRect.top,
      safeBottom,
      safeTop,
      surfaceBottom: surfaceRect.bottom,
      surfaceLeft: surfaceRect.left,
      surfaceRight: surfaceRect.right,
      surfaceTop: surfaceRect.top
    };
  });
  expect(fittedLayout.boardLeft).toBeGreaterThanOrEqual(fittedLayout.surfaceLeft - 1);
  expect(fittedLayout.boardRight).toBeLessThanOrEqual(fittedLayout.surfaceRight + 1);
  expect(fittedLayout.boardTop).toBeGreaterThanOrEqual(fittedLayout.surfaceTop - 1);
  expect(fittedLayout.boardBottom).toBeLessThanOrEqual(fittedLayout.surfaceBottom + 1);
  expect(fittedLayout.boardTop).toBeGreaterThanOrEqual(fittedLayout.safeTop - 1);
  expect(fittedLayout.boardBottom).toBeLessThanOrEqual(fittedLayout.safeBottom + 1);

  if (browserName !== "chromium") {
    return;
  }

  await nativeTwoFingerPinch(page, surface, 35, 85);
  await expect
    .poll(async () => Number(await surface.getAttribute("data-map-scale")))
    .toBeGreaterThan(minimumScale + 0.15);

  const beforePan = await surface.evaluate((node) => ({
    x: Number(node.getAttribute("data-map-translate-x")),
    y: Number(node.getAttribute("data-map-translate-y"))
  }));
  await nativeOneFingerPan(page, surface, 0, 70);
  await expect
    .poll(async () => {
      const afterX = Number(await surface.getAttribute("data-map-translate-x"));
      const afterY = Number(await surface.getAttribute("data-map-translate-y"));
      return Math.hypot(afterX - beforePan.x, afterY - beforePan.y);
    })
    .toBeGreaterThan(20);
});

test("critical Android and iPhone flows create a game and complete the main turn phases", async ({
  page
}, testInfo) => {
  test.skip(
    !isCriticalMobileProject(testInfo.project.name),
    "The complete gameplay flow runs on the canonical Android and iPhone profiles."
  );
  test.slow();
  await resetGame(page);

  const ownerUsername = uniqueUser("mobile_turn_owner");
  const ownerSession = await createAuthenticatedSession(page, ownerUsername);
  await attachSessionCookie(page, ownerSession);
  await page.goto("/react/lobby/new");
  await expect(page.getByTestId("react-shell-lobby-create-page")).toBeVisible();

  const gameName = uniqueUser("mobile_turn_uat");
  const setupSubmit = page.getByTestId("react-shell-new-game-submit");
  await page.getByTestId("react-shell-new-game-name").fill(gameName);
  await page.getByTestId("react-shell-new-game-total-players").selectOption("2");
  await page.getByTestId("react-shell-new-game-slot-2").selectOption("human");
  await expectTouchTarget(setupSubmit);
  await setupSubmit.click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/react\/game\/[^/?#]+$/);
  const gameId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
  expect(gameId).toBeTruthy();
  await expect(page.getByText(gameName)).toBeVisible();

  const joinerUsername = uniqueUser("mobile_turn_joiner");
  const joinerSession = await createAuthenticatedSession(page, joinerUsername);
  const joinResponse = await page.request.post("/api/join", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(joinerSession)}` },
    data: { gameId }
  });
  await expect(joinResponse.ok()).toBeTruthy();

  await attachSessionCookie(page, ownerSession);
  await page.reload();
  const startButton = page.getByRole("button", { name: "Avvia partita" });
  await revealMobileControl(page, startButton);
  await expectTouchTarget(startButton);
  await startButton.click();
  await expect(page.getByTestId("phase-indicator")).not.toContainText(/Lobby/i, {
    timeout: 15000
  });

  const displayedOwnerName = (
    await page.getByTestId("current-player-indicator").innerText()
  ).trim();
  const attackPair = await findAttackPair(page, displayedOwnerName);
  const reinforceButton = page.getByRole("button", { name: "Aggiungi" });
  await revealMobileControl(page, reinforceButton);
  await page.locator("#reinforce-select").selectOption(attackPair.fromId);
  const reinforcementCount = await getReinforcementCount(page);
  await page.locator("#reinforce-amount").fill(String(reinforcementCount));
  await expectTouchTarget(reinforceButton);
  await reinforceButton.click();
  await expect.poll(() => getReinforcementCount(page), { timeout: 15000 }).toBe(0);

  const attackButton = page.getByRole("button", { name: "Lancia attacco" });
  await revealMobileControl(page, attackButton);
  await page.locator("#attack-from").selectOption(attackPair.fromId);
  await page.locator("#attack-to").selectOption(attackPair.toId);
  await page.locator("#attack-dice").selectOption("1");
  await queueNextAttackRolls(page, 6, 1);
  await expectTouchTarget(attackButton);
  await attackButton.click();

  const conquestButton = page.getByRole("button", { name: "Sposta armate" });
  await revealMobileControl(page, conquestButton);
  await page.locator("#conquest-armies").fill("1");
  await expectTouchTarget(conquestButton);
  await conquestButton.click();

  const endTurnButton = page.locator("#end-turn-button");
  await revealMobileControl(page, endTurnButton);
  await expectTouchTarget(endTurnButton);
  await endTurnButton.click();
  await expect(page.locator("#fortify-group")).toBeVisible();

  const fortifyTargetOptions = page.locator("#fortify-to option");
  let fortifyToId = null;
  for (let index = 0; index < (await fortifyTargetOptions.count()); index += 1) {
    const value = await fortifyTargetOptions.nth(index).getAttribute("value");
    if (value) {
      fortifyToId = value;
      break;
    }
  }
  expect(fortifyToId).toBeTruthy();
  await page.locator("#fortify-to").selectOption(fortifyToId);
  await page.locator("#fortify-armies").fill("1");
  const fortifyButton = page.locator("#fortify-button");
  await expectTouchTarget(fortifyButton);
  await fortifyButton.click();
  await expect(fortifyButton).toBeDisabled();

  await expectTouchTarget(endTurnButton);
  await endTurnButton.click();
  await expect(endTurnButton).toBeHidden({ timeout: 15000 });
  const finalStateResponse = await page.request.get(
    `/api/state?gameId=${encodeURIComponent(gameId)}`,
    {
      headers: { Cookie: `netrisk_session=${encodeURIComponent(ownerSession)}` }
    }
  );
  await expect(finalStateResponse.ok()).toBeTruthy();
  const finalState = await finalStateResponse.json();
  expect(finalState.currentPlayerId).not.toBe(finalState.playerId);
  expect(finalState.players.some((player) => joinerUsername.startsWith(player.name))).toBe(true);
});
