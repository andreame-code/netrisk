import { expect, test } from '@playwright/test';

test('displays lobby preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Build & battle in real time' })).toBeVisible();
  await expect(page.getByText('Session preview')).toBeVisible();
});
