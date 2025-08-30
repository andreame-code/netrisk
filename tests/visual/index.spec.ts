import { test, expect } from '@playwright/test';

test('index page visual', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page).toHaveScreenshot('index.png', {
    maxDiffPixelRatio: 0.1,
  });
});
