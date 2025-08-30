import { test, expect } from '@playwright/test';

test('game page visual', async ({ page }) => {
  await page.goto('/game.html');
  await expect(page).toHaveScreenshot('game.png', {
    maxDiffPixelRatio: 0.1,
  });
});
