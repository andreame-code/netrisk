const { test, expect } = require("@playwright/test");

const { attachSessionCookie, resetGame, uniqueUser } = require("../support/game-helpers");

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

async function loadGameState(page, sessionToken, gameId) {
  const stateResponse = await page.request.get(`/api/state?gameId=${encodeURIComponent(gameId)}`, {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` }
  });
  await expect(stateResponse.ok()).toBeTruthy();
  return stateResponse.json();
}

function joinSelectedBattleButton(page, selectedRow) {
  return selectedRow
    .getByRole("button", { name: /^(Join|Entra|Join Battle|Unisciti alla battaglia)$/i })
    .or(page.getByTestId("react-shell-lobby-join-selected"))
    .or(page.getByTestId("react-shell-lobby-war-table-action"))
    .first();
}

test("react lobby keeps guest access inline with the shared auth copy", async ({ page }) => {
  await resetGame(page);

  await page.goto("/react/lobby");

  await expect(page).toHaveURL(/\/react\/lobby$/);
  await expect(page.getByTestId("react-shell-lobby-page")).toBeVisible();
  await expect(page.getByTestId("react-shell-session-status")).toContainText(/guest/i);
  await expect(page.locator("#auth-status")).toContainText(
    /Accedi per aprire e gestire le tue sessioni|Log in to open and manage your sessions/i
  );
});

test("react lobby sends a guest to login before viewing an active game", async ({ page }) => {
  await resetGame(page);

  const ownerSession = await createAuthenticatedSession(page, uniqueUser("rsh_guest_view_owner"));
  const gameName = uniqueUser("rsh_guest_view_active");
  const requestHeaders = {
    Cookie: `netrisk_session=${encodeURIComponent(ownerSession)}`
  };
  const createResponse = await page.request.post("/api/games", {
    headers: requestHeaders,
    data: {
      name: gameName,
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "ai" }
      ]
    }
  });
  await expect(createResponse.ok()).toBeTruthy();
  const createdGame = await createResponse.json();

  const startResponse = await page.request.post("/api/start", {
    headers: requestHeaders,
    data: {
      gameId: createdGame.game.id,
      playerId: createdGame.playerId
    }
  });
  await expect(startResponse.ok()).toBeTruthy();

  await page.context().clearCookies();
  await page.addInitScript(() => {
    window.localStorage.setItem("netrisk.theme", "war-table");
  });
  await page.goto("/react/lobby");

  const targetRow = page.locator("[data-testid^='react-shell-lobby-row-']", {
    hasText: gameName
  });
  await expect(targetRow).toBeVisible({ timeout: 15000 });

  const loginLink = targetRow.getByRole("link", { name: /Log in to view|Accedi per vedere/i });
  await expect(loginLink).toHaveAttribute(
    "href",
    `/react/login?next=%2Fgame%2F${encodeURIComponent(createdGame.game.id)}`
  );
  await loginLink.click();

  await expect(page).toHaveURL(new RegExp(`/react/login\\?next=%2Fgame%2F${createdGame.game.id}$`));
  await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
  await expect(page.getByText("Sessione non valida.")).toHaveCount(0);
});

test("mobile War Table lobby paginates 70+ games without limiting focus, search, or filters", async ({
  page
}) => {
  test.slow();
  await resetGame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    class DeterministicIntersectionObserver {
      disconnect() {}

      observe() {}

      takeRecords() {
        return [];
      }

      unobserve() {}
    }

    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: DeterministicIntersectionObserver,
      writable: true
    });
  });

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("rsh_lobby_owner"));
  const requestHeaders = { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` };
  for (let index = 0; index < 69; index += 1) {
    const createResponse = await page.request.post("/api/games", {
      headers: requestHeaders,
      data: {
        name: uniqueUser(`react_lobby_${String(index + 1).padStart(2, "0")}`),
        totalPlayers: 2,
        players: [
          { slot: 1, type: "human" },
          { slot: 2, type: "ai" }
        ]
      }
    });
    await expect(createResponse.ok()).toBeTruthy();
  }

  const focusedGameName = uniqueUser("react_lobby_focus_beyond_page");
  const focusedResponse = await page.request.post("/api/games", {
    headers: requestHeaders,
    data: {
      name: focusedGameName,
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "ai" }
      ]
    }
  });
  await expect(focusedResponse.ok()).toBeTruthy();
  const focusedGame = await focusedResponse.json();

  // The isolated E2E database lets this test archive the current focus without a test-only API.
  const dbFile = process.env.E2E_DB_FILE;
  expect(dbFile).toBeTruthy();
  const { DatabaseSync } = require("node:sqlite");
  const database = new DatabaseSync(dbFile);
  try {
    const storedRow = database
      .prepare("SELECT state_json FROM games WHERE id = ?")
      .get(focusedGame.game.id);
    expect(storedRow).toBeTruthy();
    const storedState = JSON.parse(storedRow.state_json);
    storedState.phase = "finished";
    const updateResult = database
      .prepare("UPDATE games SET state_json = ? WHERE id = ?")
      .run(JSON.stringify(storedState), focusedGame.game.id);
    expect(updateResult.changes).toBe(1);
  } finally {
    database.close();
  }

  const themeResponse = await page.request.put("/api/profile/preferences/theme", {
    headers: requestHeaders,
    data: { theme: "war-table" }
  });
  await expect(themeResponse.ok()).toBeTruthy();
  await attachSessionCookie(page, sessionToken);
  await page.addInitScript(() => {
    window.localStorage.setItem("netrisk.theme", "war-table");
  });
  await page.goto("/react/lobby");

  const rows = page.locator("[data-testid^='react-shell-lobby-row-']");
  await expect(rows).toHaveCount(15, { timeout: 15000 });
  await expect(page.locator("#lobby-active-focus")).toHaveText(focusedGameName);
  await expect(page.getByTestId(`react-shell-lobby-row-${focusedGame.game.id}`)).toHaveCount(0);

  const loadMoreState = page.getByTestId("react-shell-lobby-load-more");
  await expect(loadMoreState).toContainText(/15/);
  const loadMoreButton = page.getByTestId("react-shell-lobby-load-more-button");
  await expect(loadMoreButton).toBeVisible();
  await expect(loadMoreButton).toHaveAttribute("aria-controls", "game-session-list");
  const loadMoreBox = await loadMoreButton.boundingBox();
  expect(loadMoreBox?.height).toBeGreaterThanOrEqual(44);
  await loadMoreButton.evaluate((button) => button.click());
  await expect(rows).toHaveCount(30);

  const search = page.getByPlaceholder(/Search games|Cerca partite/i);
  await search.fill(focusedGameName);
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId(`react-shell-lobby-row-${focusedGame.game.id}`)).toBeVisible();

  await search.fill("");
  const statusTabs = page.getByRole("tab");
  await statusTabs.last().click();
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId(`react-shell-lobby-row-${focusedGame.game.id}`)).toBeVisible();

  await statusTabs.first().click();
  await expect(rows).toHaveCount(15);
  for (const expectedCount of [30, 45, 60, 71]) {
    await page
      .getByTestId("react-shell-lobby-load-more-button")
      .evaluate((button) => button.click());
    await expect(rows).toHaveCount(expectedCount);
  }

  await expect(page.getByTestId("react-shell-lobby-load-more-button")).toHaveCount(0);
  await expect(loadMoreState).toContainText(/71/);
});

test("react lobby can open a selected game and navigate to the React gameplay route", async ({
  page
}) => {
  await resetGame(page);

  const ownerUsername = uniqueUser("rsh_lobby_owner_open");
  const ownerSession = await createAuthenticatedSession(page, ownerUsername);
  const gameName = uniqueUser("react_lobby_open");

  const createResponse = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(ownerSession)}` },
    data: {
      name: gameName,
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

  await attachSessionCookie(page, ownerSession);
  await page.goto("/react/lobby");

  const targetRow = page.locator("[data-testid^='react-shell-lobby-row-']", {
    hasText: gameName
  });
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  await targetRow.click();

  await expect(page.getByTestId("react-shell-lobby-details")).toContainText(gameName);
  await page.getByTestId("react-shell-lobby-open-selected").click();

  await expect
    .poll(() => page.url(), { timeout: 15000 })
    .toMatch(new RegExp(`/react/game/${createdGame.game.id}$`));
  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(page.getByText(gameName)).toBeVisible();

  const statePayload = await loadGameState(page, ownerSession, createdGame.game.id);
  expect(
    statePayload.players.some((player) => ownerUsername.startsWith(String(player.name || "")))
  ).toBeTruthy();
});

test("react lobby can join an available game and navigate to the React gameplay route", async ({
  page
}) => {
  await resetGame(page);

  const ownerSession = await createAuthenticatedSession(page, uniqueUser("rsh_lobby_owner_join"));
  const joinerUsername = uniqueUser("rsh_lobby_joiner");
  const joinerSession = await createAuthenticatedSession(page, joinerUsername);
  const gameName = uniqueUser("react_lobby_join");

  const createResponse = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(ownerSession)}` },
    data: {
      name: gameName,
      mapId: "world-classic",
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "human" }
      ]
    }
  });
  await expect(createResponse.ok()).toBeTruthy();
  const createdGame = await createResponse.json();

  await attachSessionCookie(page, joinerSession);
  await page.goto("/react/lobby");

  const targetRow = page.locator("[data-testid^='react-shell-lobby-row-']", {
    hasText: gameName
  });
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  await targetRow.click();

  await expect(page.getByTestId("react-shell-lobby-details")).toContainText(gameName);
  await expect(joinSelectedBattleButton(page, targetRow)).toBeVisible();
  await joinSelectedBattleButton(page, targetRow).click();

  await expect
    .poll(() => page.url(), { timeout: 15000 })
    .toMatch(new RegExp(`/react/game/${createdGame.game.id}$`));
  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(page.getByText(gameName)).toBeVisible();

  const statePayload = await loadGameState(page, joinerSession, createdGame.game.id);
  const joinedPlayer =
    statePayload.players.find((player) => player.id === statePayload.playerId) ||
    statePayload.players.find((player) => joinerUsername.startsWith(String(player.name || "")));
  expect(joinedPlayer).toBeTruthy();
  await expect(page.getByTestId("current-player-indicator")).toContainText(
    String(joinedPlayer.name || "")
  );
});

test("react lobby shows controlled feedback when join fails", async ({ page }) => {
  await resetGame(page);

  const ownerSession = await createAuthenticatedSession(page, uniqueUser("rsh_lobby_owner_fail"));
  const joinerSession = await createAuthenticatedSession(page, uniqueUser("rsh_lobby_joiner_fail"));
  const gameName = uniqueUser("react_lobby_fail");

  const createResponse = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(ownerSession)}` },
    data: {
      name: gameName,
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "human" }
      ]
    }
  });
  await expect(createResponse.ok()).toBeTruthy();

  await attachSessionCookie(page, joinerSession);
  await page.route("**/api/join", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Join failed."
      })
    });
  });

  await page.goto("/react/lobby");

  const targetRow = page.locator("[data-testid^='react-shell-lobby-row-']", {
    hasText: gameName
  });
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  await targetRow.click();
  await joinSelectedBattleButton(page, targetRow).click();

  await expect(page).toHaveURL(/\/react\/lobby$/);
  await expect(page.getByTestId("react-shell-lobby-action-error")).toBeVisible();
  await expect(page.getByTestId("react-shell-lobby-action-error")).toContainText(
    /Join failed|Richiesta fallita/
  );
});
