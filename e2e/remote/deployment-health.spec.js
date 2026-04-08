const { test, expect } = require("@playwright/test");

test("remote deployment exposes healthy supabase-backed APIs", async ({ request }) => {
  const healthResponse = await request.get("/api/health");
  await expect(healthResponse.ok()).toBeTruthy();

  const health = await healthResponse.json();
  expect(health.ok).toBeTruthy();
  expect(health.storage?.ok).toBeTruthy();
  expect(health.storage?.storage).toBe("supabase");

  const gamesResponse = await request.get("/api/games");
  await expect(gamesResponse.ok()).toBeTruthy();

  const gamesPayload = await gamesResponse.json();
  expect(Array.isArray(gamesPayload.games)).toBeTruthy();
  expect(gamesPayload.games.length).toBeGreaterThan(0);
});
