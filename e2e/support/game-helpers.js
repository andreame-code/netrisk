const { expect } = require("@playwright/test");

function uniqueUser(prefix) {
  return prefix + "_" + Date.now().toString(36).slice(-6) + Math.random().toString(16).slice(2, 4);
}

async function registerLoginAndJoin(page, username, password = "secret123") {
  await page.getByPlaceholder("Utente").fill(username);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Registrati" }).click();
  await expect(page.getByTestId("current-player-indicator")).toContainText(username, { timeout: 10000 });
  await page.getByRole("button", { name: "Entra nella lobby" }).click();
  await expect(page.getByTestId("current-player-indicator")).toContainText(username, { timeout: 10000 });
}

module.exports = {
  registerLoginAndJoin,
  uniqueUser
};
