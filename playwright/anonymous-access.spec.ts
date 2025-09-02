import { test, expect } from '@playwright/test';
import { assertLoggedInUI, assertLoggedOutUI } from './utils';

async function mockSupabase(page) {
  await page.route('**/src/init/supabase-client.js*', (route) =>
    route.fulfill({
      body: `
        const state = { user: null, session: null };
        const listeners = [];
        const supabase = {
          auth: {
            storage: window.sessionStorage,
            onAuthStateChange: (cb) => { listeners.push(cb); },
            getSession: async () => ({ data: { session: state.session }, error: null }),
            getUser: async () => ({ data: { user: state.session ? state.user : null }, error: null }),
            signInWithPassword: async ({ email, password }) => {
              if (password === 'password') {
                state.user = { id: '1', email };
                state.session = { access_token: 'token' };
                try {
                  sessionStorage.setItem('mockUser', JSON.stringify(state.user));
                  sessionStorage.setItem('mockSession', JSON.stringify(state.session));
                } catch {}
                listeners.forEach((cb) => cb('SIGNED_IN', { user: state.user, session: state.session }));
                return { data: { user: state.user, session: state.session }, error: null };
              }
              return { data: { user: null, session: null }, error: { message: 'Invalid' } };
            },
            signInAnonymously: async () => {
              state.user = { id: 'anon' };
              state.session = { access_token: 'anon' };
              try {
                sessionStorage.setItem('mockUser', JSON.stringify(state.user));
                sessionStorage.setItem('mockSession', JSON.stringify(state.session));
              } catch {}
              listeners.forEach((cb) => cb('SIGNED_IN', { user: state.user, session: state.session }));
              return { data: { user: state.user, session: state.session }, error: null };
            },
            setSession: async (session) => {
              state.session = session;
              try { sessionStorage.setItem('mockSession', JSON.stringify(state.session)); } catch {}
              return { data: { session: state.session }, error: null };
            },
            signOut: async () => {
              state.user = null;
              state.session = null;
              try {
                sessionStorage.removeItem('mockUser');
                sessionStorage.removeItem('mockSession');
              } catch {}
              listeners.forEach((cb) => cb('SIGNED_OUT', {}));
              return { error: null };
            },
          },
          from: () => ({
            select() { return this; },
            eq() { return this; },
            contains() { return this; },
            limit: async () => ({ data: [] }),
          }),
        };
        export function registerAuthListener(handler) { listeners.push(handler); }
        export default supabase;
      `,
      contentType: 'application/javascript',
    }),
  );
  await page.route('**/supabase.co/**', (route) =>
    route.fulfill({ status: 200, body: '{}', headers: { 'content-type': 'application/json' } }),
  );
}

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
