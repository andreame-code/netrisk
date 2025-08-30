import { test, expect } from '@playwright/test';

test('lobby page visual', async ({ page }) => {
  await page.goto('/lobby.html');
  await expect(page).toHaveScreenshot('lobby.png', {
    maxDiffPixelRatio: 0.1,
  });
});
