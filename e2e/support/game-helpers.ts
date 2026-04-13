const { expect } = require("@playwright/test");
const { randomHex } = require("../../.tsbuild/backend/random.cjs");

function uniqueUser(prefix) {
  return prefix + "_" + Date.now().toString(36).slice(-6) + randomHex(2);
}

async function resetGame(page) {
  const attempts = 3;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await page.request.post("/api/test/reset");
      await expect(response.ok()).toBeTruthy();
      return;
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

async function registerAndLogin(page, username, password = "secret123") {
  const registerResponse = await page.request.post("/api/auth/register", {
    data: { username, password }
  });
  await expect(registerResponse.ok()).toBeTruthy();

  const loginResponse = await page.request.post("/api/auth/login", {
    data: { username, password }
  });
  await expect(loginResponse.ok()).toBeTruthy();

  await page.goto("/game.html");
  await expect(page.locator("#auth-status")).toContainText(username, { timeout: 10000 });
}

async function registerLoginAndJoin(page, username, password = "secret123") {
  await registerAndLogin(page, username, password);
  await page.getByRole("button", { name: "Entra nella lobby" }).click();
  await expect(page.getByTestId("current-player-indicator")).toContainText(username, { timeout: 10000 });
}

async function getReinforcementCount(page) {
  const summaryText = await page.getByTestId("status-summary").innerText();
  const match = summaryText.match(/Rinforzi disponibili:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

async function findAttackPair(page, ownerName) {
  const ownedButtons = page.locator('[data-territory-id]').filter({ hasText: ownerName });
  const total = await ownedButtons.count();

  for (let index = 0; index < total; index += 1) {
    await ownedButtons.nth(index).click();
    const attackTo = page.locator('#attack-to option');
    const optionCount = await attackTo.count();

    for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
      const option = attackTo.nth(optionIndex);
      const value = await option.getAttribute('value');
      if (value) {
        return {
          fromId: await page.locator('#attack-from').inputValue(),
          toId: value
        };
      }
    }
  }

  throw new Error('Nessuna coppia attacco valida trovata per ' + ownerName + '.');
}

module.exports = {
  findAttackPair,
  getReinforcementCount,
  queueNextAttackRolls,
  registerAndLogin,
  registerLoginAndJoin,
  resetGame,
  uniqueUser
};
