const { test, expect } = require("@playwright/test");
const { uniqueUser } = require("../support/game-helpers");

test("profile page lists participating games and opens the selected game route", async ({ page }) => {
  const username = uniqueUser("profile_games");
  const password = "secret123";

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
  const gameName = `Profilo partita ${Date.now().toString(36).slice(-4)}`;

  const createGameResponse = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken || "")}` },
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
  await expect(createGameResponse.ok()).toBeTruthy();
  const createdGame = await createGameResponse.json();

  await page.context().addCookies([{
    name: "netrisk_session",
    value: sessionToken,
    url: "http://127.0.0.1:3100",
    httpOnly: true,
    sameSite: "Lax"
  }]);

  await page.goto("/profile.html");

  await expect(page.getByTestId("player-profile-shell")).toBeVisible();
  await expect(page.locator("#profile-feedback")).toBeHidden();
  await expect(page.locator("#profile-content")).not.toHaveAttribute("hidden", "");
  await expect(page.locator("#metric-in-progress")).toContainText("1");
  await expect(page.locator("#profile-games-count")).toContainText("1 attiva");

  const gameRow = page.locator("[data-open-game-id='" + createdGame.game.id + "']");
  await expect(gameRow).toBeVisible();
  await expect(gameRow).toContainText(gameName);
  await expect(gameRow).toContainText("World Classic");
  await expect(gameRow).toContainText("Teatro operativo");
  await expect(gameRow).toContainText("Lobby");
  await expect(gameRow).toContainText("/2 giocatori");
  await expect(gameRow).toContainText("Mini lobby personale");
  await expect(gameRow).toContainText(username);
  await expect(gameRow).toContainText("In attesa avvio");
  await expect(gameRow).toContainText("Lobby");

  await gameRow.click();

  await page.waitForURL("**/game/" + createdGame.game.id);
  await expect(page.locator("#game-status")).toContainText(gameName);
  await expect(page.locator("#game-map-meta")).toContainText("World Classic");
});
