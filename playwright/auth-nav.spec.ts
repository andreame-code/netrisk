import { test, expect } from '@playwright/test';
import { login, assertLoggedInUI, assertLoggedOutUI, mockSupabase } from './utils';

test.describe('auth navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/account.html');
    await page.waitForURL('**/login.html?message=*');
    await expect(page.getByTestId('auth-guard-msg')).toHaveText('Accedi per vedere il tuo profilo');
    await assertLoggedOutUI(page);
  });

  test('allows authenticated navigation persistence', async ({ page }) => {
    await login(page);
    await page.waitForURL('**/account.html');
    await assertLoggedInUI(page);
    await page.goto('/index.html');
    await assertLoggedInUI(page);
    await page.reload();
    await assertLoggedInUI(page);
    await page.goto('/account.html');
    await expect(page).toHaveURL(/account\.html$/);
    await assertLoggedInUI(page);
  });
});
