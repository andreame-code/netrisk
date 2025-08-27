import { test, expect } from '@playwright/test';

test('homepage responds and has a title', async ({ page, baseURL }) => {
  const url = baseURL || 'http://localhost:4173';
  await page.goto(url);
  await expect(page).toHaveTitle(/netrisk|Risk|Game|Play/i);
});
