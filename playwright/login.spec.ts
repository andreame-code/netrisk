import { test, expect } from '@playwright/test';
import { login, assertLoggedInUI, assertLoggedOutUI, mockSupabase } from './utils';

test.describe('login flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test('valid login', async ({ page }) => {
    await login(page);
    await page.waitForURL('**/account.html');
    await assertLoggedInUI(page);
  });

  test('invalid login', async ({ page }) => {
    await login(page, 'user@example.com', 'wrong');
    await expect(page.getByTestId('error-msg')).toHaveText('Credenziali non valide');
    await assertLoggedOutUI(page);
  });

  test('logout resets state', async ({ page }) => {
    await login(page);
    await page.waitForURL('**/account.html');
    await assertLoggedInUI(page);
    await page.getByTestId('logout-btn').click();
    await page.waitForURL('**/index.html');
    await assertLoggedOutUI(page);
  });
});
