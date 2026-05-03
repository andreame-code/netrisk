const { expect } = require("@playwright/test");
const { randomHex } = require("../../.tsbuild/backend/random.cjs");

function getE2EBaseURL() {
  return (
    process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3100"
  );
}

function uniqueUser(prefix) {
  return prefix + "_" + Date.now().toString(36).slice(-6) + randomHex(2);
}

let sharedLobbyGameId = null;

async function resetGame(page) {
  const attempts = 3;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await page.request.post("/api/test/reset");
      await expect(response.ok()).toBeTruthy();
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) {
        break;
      }
      await page.waitForTimeout(250 * (attempt + 1));
    }
  }

  throw lastError;
}

async function queueNextAttackRolls(page, attackRoll, defendRoll) {
  const response = await page.request.post("/api/test/next-attack-rolls", {
    data: { attackRoll, defendRoll }
  });
  await expect(response.ok()).toBeTruthy();
}

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

async function preferCommandTheme(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("netrisk.theme", "command");
  });
}

async function setSessionThemePreference(page, sessionToken, theme = "command") {
  const response = await page.request.put("/api/profile/preferences/theme", {
    headers: {
      Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}`
    },
    data: { theme }
  });
  await expect(response.ok()).toBeTruthy();
}

async function registerAndLogin(page, username, password = "secret123") {
  const sessionToken = await createAuthenticatedSession(page, username, password);
  await setSessionThemePreference(page, sessionToken, "command");
  await preferCommandTheme(page);
  await attachSessionCookie(page, sessionToken);
  await page.goto("/lobby");
  await expect(page.locator(".shell-header #auth-status")).toContainText(username, {
    timeout: 10000
  });

  return sessionToken;
}

async function ensureSharedLobbyGame(page, sessionToken) {
  const requestHeaders = {
    Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}`
  };

  if (sharedLobbyGameId) {
    try {
      const stateResponse = await page.request.get(
        `/api/state?gameId=${encodeURIComponent(sharedLobbyGameId)}`,
        {
          headers: requestHeaders
        }
      );
      if (stateResponse.ok()) {
        return sharedLobbyGameId;
      }
    } catch (error) {
      void error;
    }

    sharedLobbyGameId = null;
  }

  const createResponse = await page.request.post("/api/games", {
    headers: requestHeaders,
    data: {
      name: uniqueUser("react_lobby"),
      totalPlayers: 2,
      players: [
        { slot: 1, type: "human" },
        { slot: 2, type: "human" }
      ]
    }
  });
  await expect(createResponse.ok()).toBeTruthy();
  const createdGame = await createResponse.json();
  sharedLobbyGameId = createdGame.game.id;

  return sharedLobbyGameId;
}

async function registerLoginAndJoin(page, username, password = "secret123") {
  const sessionToken = await registerAndLogin(page, username, password);
  const gameId = await ensureSharedLobbyGame(page, sessionToken);
  const joinResponse = await page.request.post("/api/join", {
    headers: {
      Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}`
    },
    data: { gameId }
  });

  if (joinResponse.ok()) {
    await joinResponse.json();
  }

  await page.goto(`/game/${encodeURIComponent(gameId)}`);
  await expect(page.getByTestId("current-player-indicator")).toContainText(username, {
    timeout: 10000
  });

  return {
    gameId,
    sessionToken
  };
}

async function attachSessionCookie(page, sessionToken) {
  await page.context().addCookies([
    {
      name: "netrisk_session",
      value: sessionToken,
      url: getE2EBaseURL(),
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

async function getReinforcementCount(page) {
  const summaryText = await page.getByTestId("status-summary").innerText();
  const match = summaryText.match(/Rinforzi(?:\s+disponibili)?[\s:]+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

async function findAttackPair(page, ownerName) {
  const ownedButtons = page.locator("[data-territory-id]").filter({ hasText: ownerName });
  const total = await ownedButtons.count();

  for (let index = 0; index < total; index += 1) {
    await ownedButtons.nth(index).click();
    const attackTo = page.locator("#attack-to option");
    const optionCount = await attackTo.count();

    for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
      const option = attackTo.nth(optionIndex);
      const value = await option.getAttribute("value");
      if (value) {
        return {
          fromId: await page.locator("#attack-from").inputValue(),
          toId: value
        };
      }
    }
  }

  throw new Error("Nessuna coppia attacco valida trovata per " + ownerName + ".");
}

module.exports = {
  attachSessionCookie,
  createAuthenticatedSession,
  findAttackPair,
  getReinforcementCount,
  getE2EBaseURL,
  preferCommandTheme,
  queueNextAttackRolls,
  registerAndLogin,
  registerLoginAndJoin,
  resetGame,
  setSessionThemePreference,
  uniqueUser
};
