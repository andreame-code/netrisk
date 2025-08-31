import { test, expect } from '@playwright/test';

test.describe('smoke auth', () => {
  test('anonymous auth flow', async ({ page }) => {
    await page.route('**/src/init/supabase-client.js*', (route) =>
      route.fulfill({
        body: `
          const supabase = {
            auth: {
              getUser: async () => ({ data: { user: globalThis.__user || null } }),
              onAuthStateChange: (cb) => { globalThis.__auth_cb = cb; },
              signOut: async () => { globalThis.__user = null; globalThis.__auth_cb?.('SIGNED_OUT', { user: null }); },
            },
          };
          export default supabase;
        `,
        contentType: 'application/javascript',
      }),
    );

    await page.goto('/index.html');
    await expect(page.locator('#authLink')).toHaveText('Login');
    await expect(page.locator('text=Unable to load data')).toHaveCount(0);

    await page.evaluate(() => {
      globalThis.__user = { id: 'anon' };
      globalThis.__auth_cb?.('SIGNED_IN', { user: globalThis.__user });
    });

    await expect(page.locator('#authLink')).toHaveText('Logout');
    await expect(page.locator('#playBtn')).toBeVisible();
    await expect(page.locator('#multiplayerBtn')).toBeVisible();
    await expect(page.locator('#setupBtn')).toBeVisible();
    await expect(page.locator('#howToPlayBtn')).toBeVisible();
    await expect(page.locator('#aboutBtn')).toBeVisible();
    await expect(page.locator('text=Unable to load data')).toHaveCount(0);
  });
});
