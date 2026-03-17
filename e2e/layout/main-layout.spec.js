const { test, expect } = require("@playwright/test");

test("main layout exposes core regions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("battlefield-layout")).toBeVisible();
  await expect(page.getByTestId("map-panel")).toBeVisible();
  await expect(page.getByTestId("map-region")).toBeVisible();
  await expect(page.getByTestId("info-panel")).toBeVisible();
  await expect(page.getByTestId("actions-panel")).toBeVisible();
  await expect(page.getByTestId("current-player-indicator")).toBeVisible();
  await expect(page.getByTestId("phase-indicator")).not.toBeEmpty();
  await expect(page.getByTestId("status-summary")).toBeVisible();
});
