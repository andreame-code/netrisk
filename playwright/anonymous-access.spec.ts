import { test, expect } from '@playwright/test';
import { assertLoggedInUI, assertLoggedOutUI, mockSupabase } from './utils';

test.describe('anonymous access', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test('anonymous user sees allowed features only', async ({ page }) => {
    await page.goto('/index.html');
    await assertLoggedOutUI(page);
    await expect(page.getByTestId('lobby-link')).toHaveCount(0);
    await page.goto('/login.html');
    await page.getByTestId('login-anon').click();
    await page.waitForURL('**/account.html');
    await page.goto('/index.html');
    await assertLoggedInUI(page);
    await expect(page.getByTestId('lobby-link')).toBeVisible();
  });
});
