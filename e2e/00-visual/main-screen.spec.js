const { test, expect } = require("@playwright/test");

test("battlefield layout matches the baseline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("battlefield-layout")).toHaveScreenshot("battlefield-layout.png");
});
