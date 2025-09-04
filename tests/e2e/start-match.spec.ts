import { test, expect } from '@playwright/test';
import { authenticate, setupLobby } from './utils';

test.describe('start match flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
    await page.route('**/src/init/supabase-client.js*', (route) =>
      route.fulfill({
        body: `
          let user = null;
          let session = null;
          const listeners = [];
          const supabase = {
            auth: {
              storage: window.sessionStorage,
              onAuthStateChange: (cb) => { listeners.push(cb); },
              async signInWithPassword({ email }) {
                user = { id: 'u1', email };
                session = { access_token: 'token', user };
                listeners.forEach((cb) => cb('SIGNED_IN', { user, session }));
                return { data: { user, session }, error: null };
              },
              async setSession(s) { session = s; return { data: { session }, error: null }; },
              async getSession() { return { data: { session }, error: null }; },
              async getUser() { return { data: { user }, error: null }; },
              async signOut() {
                user = null;
                session = null;
                listeners.forEach((cb) => cb('SIGNED_OUT', {}));
                return { error: null };
              },
            },
          };
          export { supabase };
          export function registerAuthListener(handler) { listeners.push(handler); }
          export default supabase;
        `,
        contentType: 'application/javascript',
      }),
    );
    await page.route('**/supabase.co/**', (route) => {
      route.fulfill({
        status: 200,
        body: '{}',
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  test('two players start a match and enter reinforce phase', async ({ page }) => {
    await authenticate(page);
    await expect(page.getByText('Unable to load data')).toHaveCount(0);
    await setupLobby(page);
    await page.goto('/setup.html');
    await expect(page.getByText('Unable to load data')).toHaveCount(0);
    await page.fill('#name0', 'Red');
    await page.fill('#name1', 'Blue');
    await page.waitForSelector('#mapGrid .map-item');
    await page.click('button[type="submit"]');
    await page.goto('/game.html');
    await expect(page.locator('#status')).toHaveText('reinforce');
  });
});
