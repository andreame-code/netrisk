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

test("react lobby shows the first page and can reveal the full session list", async ({ page }) => {
  await resetGame(page);

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("rsh_lobby_owner"));

  for (let index = 0; index < 18; index += 1) {
    const createResponse = await page.request.post("/api/games", {
      headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` },
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

  await attachSessionCookie(page, sessionToken);
  await page.goto("/react/lobby");

  const rows = page.locator("[data-testid^='react-shell-lobby-row-']");
  await expect
    .poll(async () => rows.count(), {
      message: "the lobby should render at least the first batch of sessions"
    })
    .toBeGreaterThanOrEqual(15);

  const initialCount = await rows.count();
  expect(initialCount).toBeLessThanOrEqual(19);

  const loadMoreState = page.getByTestId("react-shell-lobby-load-more");
  await expect(loadMoreState).toContainText(new RegExp(String(initialCount)));

  if (initialCount < 19) {
    await loadMoreState.scrollIntoViewIfNeeded();
    await expect.poll(async () => rows.count()).toBe(19);
  }

  await expect(loadMoreState).toContainText(/19/);
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
  await expect(targetRow).toBeVisible();
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
  await expect(targetRow).toBeVisible();
  await targetRow.click();

  await expect(page.getByTestId("react-shell-lobby-details")).toContainText(gameName);
  await expect(page.getByTestId("react-shell-lobby-join-selected")).toBeVisible();
  await page.getByTestId("react-shell-lobby-join-selected").click();

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
  await expect(targetRow).toBeVisible();
  await targetRow.click();
  await page.getByTestId("react-shell-lobby-join-selected").click();

  await expect(page).toHaveURL(/\/react\/lobby$/);
  await expect(page.getByTestId("react-shell-lobby-action-error")).toBeVisible();
  await expect(page.getByTestId("react-shell-lobby-action-error")).toContainText(
    /Join failed|Richiesta fallita/
  );
});
