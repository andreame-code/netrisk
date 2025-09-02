import { test, expect } from '@playwright/test';
import { login, mockSupabase } from './utils';

test.describe('session expiry', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test('prompts re-login after token expiration', async ({ page }) => {
    await login(page);
    await page.waitForURL('**/account.html');
    await page.evaluate(() => {
      sessionStorage.removeItem('mockSession');
      sessionStorage.removeItem('mockUser');
    });
    await page.reload();
    await page.waitForURL('**/login.html?message=*');
    await expect(page.getByTestId('auth-guard-msg')).toHaveText('Accedi per vedere il tuo profilo');
  });
});
