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

test("react lobby redirects guests to the login route", async ({ page }) => {
  await resetGame(page);

  await page.goto("/react/lobby");

  await expect(page).toHaveURL(/\/react\/login\?next=%2Flobby$/);
  await expect(page.getByTestId("react-shell-login-page")).toBeVisible();
});

test("react lobby shows 15 sessions initially and loads more on scroll", async ({ page }) => {
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
  await expect(rows).toHaveCount(15);
  await expect(page.getByTestId("react-shell-lobby-load-more")).toContainText(/15/);

  await page.getByTestId("react-shell-lobby-load-more").scrollIntoViewIfNeeded();

  await expect.poll(async () => rows.count()).toBe(19);
  await expect(page.getByTestId("react-shell-lobby-load-more")).toContainText(/19/);
});

test("react lobby can open a selected game and hand off to the legacy board", async ({ page }) => {
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

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(
    new RegExp(`/game/${createdGame.game.id}$`)
  );
  await expect(page.locator("#game-status")).toContainText(gameName, { timeout: 15000 });

  const statePayload = await loadGameState(page, ownerSession, createdGame.game.id);
  expect(
    statePayload.players.some((player) => ownerUsername.startsWith(String(player.name || "")))
  ).toBeTruthy();
});

test("react lobby can join an available game and hand off to the legacy board", async ({ page }) => {
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

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(
    new RegExp(`/game/${createdGame.game.id}$`)
  );
  await expect(page.locator("#game-status")).toContainText(gameName, { timeout: 15000 });

  const statePayload = await loadGameState(page, joinerSession, createdGame.game.id);
  expect(
    statePayload.players.some((player) => joinerUsername.startsWith(String(player.name || "")))
  ).toBeTruthy();
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
