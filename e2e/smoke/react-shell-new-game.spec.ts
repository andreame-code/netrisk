const { test, expect } = require("@playwright/test");
const { DatabaseSync } = require("node:sqlite");

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

function currentGameId(url) {
  return url.match(/\/(?:react\/)?game\/([^/?#]+)/)?.[1] || null;
}

async function loadGameState(page, sessionToken, gameId) {
  const stateResponse = await page.request.get(`/api/state?gameId=${encodeURIComponent(gameId)}`, {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` }
  });
  await expect(stateResponse.ok()).toBeTruthy();
  return stateResponse.json();
}

function promoteUserToAdmin(username) {
  const dbFile = process.env.E2E_DB_FILE;
  expect(dbFile).toBeTruthy();

  const db = new DatabaseSync(dbFile);
  try {
    db.prepare("UPDATE users SET role = 'admin' WHERE lower(username) = lower(?)").run(username);
  } finally {
    db.close();
  }
}

async function enableModule(page, sessionToken, moduleId) {
  const response = await page.request.post(`/api/modules/${encodeURIComponent(moduleId)}/enable`, {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` }
  });
  await expect(response.ok()).toBeTruthy();
}

test("react new game shows loading before creation options render", async ({ page }) => {
  await resetGame(page);

  const sessionToken = await createAuthenticatedSession(page, uniqueUser("rsh_new_game_loading"));
  await attachSessionCookie(page, sessionToken);

  let releaseOptionsResponse;
  const optionsResponseReleased = new Promise((resolve) => {
    releaseOptionsResponse = resolve;
  });

  await page.route("**/api/game/options", async (route) => {
    await optionsResponseReleased;
    await route.continue();
  });

  const navigation = page.goto("/react/lobby/new");
  await expect(page.getByTestId("react-shell-new-game-loading")).toBeVisible();
  releaseOptionsResponse();
  await navigation;

  await expect(page.getByTestId("react-shell-lobby-create-page")).toBeVisible();
});

test("react new game creates a session and opens the React gameplay route", async ({ page }) => {
  await resetGame(page);

  const commander = uniqueUser("rsh_new_game_basic");
  const sessionToken = await createAuthenticatedSession(page, commander);
  const gameName = uniqueUser("react_new_game_basic");

  await attachSessionCookie(page, sessionToken);
  await page.goto("/react/lobby/new");

  await expect(page.getByTestId("react-shell-lobby-create-page")).toBeVisible();
  await page.getByTestId("react-shell-new-game-name").fill(gameName);
  await page.getByTestId("react-shell-new-game-total-players").selectOption("3");
  await page.getByTestId("react-shell-new-game-slot-2").selectOption("human");
  await page.getByTestId("react-shell-new-game-slot-3").selectOption("ai");
  await page.getByTestId("react-shell-new-game-submit").click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/react\/game\/[^/?#]+$/);
  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(page.getByText(gameName)).toBeVisible();

  const gameId = currentGameId(page.url());
  expect(gameId).toBeTruthy();

  const statePayload = await loadGameState(page, sessionToken, gameId);
  expect(statePayload.gameName).toBe(gameName);
  expect(statePayload.phase).toBe("lobby");
  expect(statePayload.gameConfig.totalPlayers).toBe(3);
  expect(
    statePayload.players.some((player) => commander.startsWith(String(player.name || "")))
  ).toBeTruthy();
});

test("react new game supports advanced module, profile, and option selections", async ({ page }) => {
  await resetGame(page);

  const commander = uniqueUser("rsh_new_game_advanced");
  const sessionToken = await createAuthenticatedSession(page, commander);
  const gameName = uniqueUser("react_new_game_advanced");

  promoteUserToAdmin(commander);
  await enableModule(page, sessionToken, "demo.command-center");

  await attachSessionCookie(page, sessionToken);
  await page.goto("/react/lobby/new");

  await expect(page.getByTestId("react-shell-lobby-create-page")).toBeVisible();
  await page.getByTestId("react-shell-new-game-name").fill(gameName);
  await page.getByTestId("react-shell-new-game-total-players").selectOption("4");
  await page.getByTestId("react-shell-new-game-slot-2").selectOption("ai");
  await page.getByTestId("react-shell-new-game-slot-3").selectOption("human");
  await page.getByTestId("react-shell-new-game-slot-4").selectOption("ai");
  await page.getByTestId("react-shell-new-game-customize-options").check();
  await page.getByTestId("react-shell-new-game-map").selectOption("world-classic");
  await page.getByTestId("react-shell-new-game-dice").selectOption("defense-3");
  await page.getByTestId("react-shell-new-game-victory").selectOption("majority-control");

  await page
    .getByTestId("react-shell-new-game-preset")
    .selectOption("demo.command-center.command-ops");
  await expect(page.getByTestId("react-shell-new-game-map")).toHaveValue("world-classic");
  await expect(page.getByTestId("react-shell-new-game-dice")).toHaveValue("defense-3");
  await expect(page.getByTestId("react-shell-new-game-victory")).toHaveValue(
    "majority-control"
  );
  await expect(
    page.getByTestId("react-shell-new-game-module-demo.command-center")
  ).toBeChecked();
  await expect(page.getByTestId("react-shell-new-game-content-profile")).toHaveValue(
    "demo.command-center.content"
  );
  await expect(page.getByTestId("react-shell-new-game-gameplay-profile")).toHaveValue(
    "demo.command-center.gameplay"
  );
  await expect(page.getByTestId("react-shell-new-game-ui-profile")).toHaveValue(
    "demo.command-center.ui"
  );

  await page.getByTestId("react-shell-new-game-ruleset").selectOption("classic-defense-3");
  await page.getByTestId("react-shell-new-game-map").selectOption("classic-mini");
  await page.getByTestId("react-shell-new-game-dice").selectOption("standard");
  await page.getByTestId("react-shell-new-game-victory").selectOption("conquest");
  await page.getByTestId("react-shell-new-game-theme").selectOption("ember");
  await page.getByTestId("react-shell-new-game-piece-skin").selectOption("command-ring");
  await page
    .getByTestId("react-shell-new-game-content-profile")
    .selectOption("demo.command-center.content");
  await page
    .getByTestId("react-shell-new-game-gameplay-profile")
    .selectOption("demo.command-center.gameplay");
  await page.getByTestId("react-shell-new-game-ui-profile").selectOption("demo.command-center.ui");

  const timeoutValues = await page
    .locator("[data-testid='react-shell-new-game-turn-timeout'] option")
    .evaluateAll((options) =>
      options.map((option) => option.value).filter((value) => value && /^\d+$/.test(value))
    );
  const selectedTurnTimeout = timeoutValues.at(-1) || timeoutValues[0] || "24";
  await page.getByTestId("react-shell-new-game-turn-timeout").selectOption(selectedTurnTimeout);

  await page.getByTestId("react-shell-new-game-submit").click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/react\/game\/[^/?#]+$/);
  await expect(page.getByTestId("react-shell-game-page")).toBeVisible();
  await expect(page.getByText(gameName)).toBeVisible();

  const gameId = currentGameId(page.url());
  expect(gameId).toBeTruthy();

  const statePayload = await loadGameState(page, sessionToken, gameId);
  expect(statePayload.gameName).toBe(gameName);
  expect(statePayload.phase).toBe("lobby");
  expect(statePayload.gameConfig.totalPlayers).toBe(4);
  expect(
    statePayload.players.some((player) => commander.startsWith(String(player.name || "")))
  ).toBeTruthy();
  expect(statePayload.gameConfig.ruleSetId).toBe("classic-defense-3");
  expect(statePayload.gameConfig.mapId).toBe("classic-mini");
  expect(statePayload.gameConfig.diceRuleSetId).toBe("standard");
  expect(statePayload.gameConfig.victoryRuleSetId).toBe("conquest");
  expect(statePayload.gameConfig.themeId).toBe("ember");
  expect(statePayload.gameConfig.pieceSkinId).toBe("command-ring");
  expect(statePayload.gameConfig.turnTimeoutHours).toBe(Number(selectedTurnTimeout));
  expect(statePayload.gameConfig.contentProfileId).toBe("demo.command-center.content");
  expect(statePayload.gameConfig.gameplayProfileId).toBe("demo.command-center.gameplay");
  expect(statePayload.gameConfig.uiProfileId).toBe("demo.command-center.ui");
  expect(statePayload.gameConfig.activeModules.map((entry) => entry.id)).toContain(
    "demo.command-center"
  );
});
