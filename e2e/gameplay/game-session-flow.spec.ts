const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers");

test("user can create a new game, see it in the list, and open it immediately", async ({ page }) => {
  test.slow();
  const gameName = uniqueUser("campagna");
  const owner = uniqueUser("lobby_owner");

  async function loginAgainIfNeeded() {
    if (await page.locator("#header-login-button").isVisible()) {
      const response = await page.request.post("/api/auth/login", {
        data: { username: owner, password: "secret123" }
      });
      await expect(response.ok()).toBeTruthy();
      await page.reload();
    }
  }

  await resetGame(page);
  await page.goto("/game");
  await registerAndLogin(page, owner);
  await page.goto("/lobby");
  await loginAgainIfNeeded();

  await page.locator("#create-game-button").click();
  await expect(page).toHaveURL(/\/lobby\/new$/);
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await expect(page.locator("#submit-new-game")).toBeEnabled();
  await page.locator("#setup-game-name").fill(gameName);
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/game(?:\/|\.html\?gameId=)/);
  await expect(page.locator("#game-status")).toContainText(gameName, { timeout: 15000 });
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i, { timeout: 15000 });

  await page.goto("/lobby");
  await loginAgainIfNeeded();
  await expect(page.getByTestId("game-session-list")).toContainText(gameName);
  await expect(page.getByTestId("game-session-details")).toContainText(gameName);

  await page.goto("/lobby");
  await loginAgainIfNeeded();
  const targetRow = page.locator("#game-session-list [data-game-id]", { hasText: gameName }).first();
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  const targetValue = await targetRow.getAttribute("data-game-id");
  await targetRow.click();
  await page.locator("#open-game-button").click();

  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(new RegExp("/game/" + targetValue + "$"));
  await expect(page.locator("#game-status")).toContainText(gameName, { timeout: 15000 });
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i, { timeout: 15000 });

  await page.reload();

  expect(page.url()).toContain("/game/" + targetValue);
  await expect(page.locator("#game-status")).toContainText(gameName, { timeout: 15000 });
  await expect(page.getByTestId("phase-indicator")).toContainText(/Lobby/i, { timeout: 15000 });
});

