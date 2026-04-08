const { test, expect } = require("@playwright/test");

test("remote lobby page renders visible sessions from the live API", async ({ page, request }) => {
  const gamesResponse = await request.get("/api/games");
  await expect(gamesResponse.ok()).toBeTruthy();
  const gamesPayload = await gamesResponse.json();
  expect(Array.isArray(gamesPayload.games)).toBeTruthy();
  expect(gamesPayload.games.length).toBeGreaterThan(0);

  await page.goto("/lobby.html");

  await expect(page.getByTestId("game-lobby-shell")).toBeVisible();
  await expect(page.locator("#game-list-state")).toBeHidden({ timeout: 15000 });
  await expect(page.locator("[data-game-id]").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#lobby-total-games")).not.toHaveText("0", { timeout: 15000 });
});
