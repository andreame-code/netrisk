const { expect } = require("@playwright/test");

function uniqueUser(prefix) {
  return prefix + "_" + Date.now().toString(36).slice(-6) + Math.random().toString(16).slice(2, 4);
}

async function resetGame(page) {
  const response = await page.request.post("/api/test/reset");
  await expect(response.ok()).toBeTruthy();
}

async function queueNextAttackRolls(page, attackRoll, defendRoll) {
  const response = await page.request.post("/api/test/next-attack-rolls", {
    data: { attackRoll, defendRoll }
  });
  await expect(response.ok()).toBeTruthy();
}

async function registerAndLogin(page, username, password = "secret123") {
  await page.getByPlaceholder("Utente").fill(username);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Registrati" }).click();
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
