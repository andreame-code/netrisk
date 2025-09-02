import { test, expect } from '@playwright/test';

test.describe('login', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
    await page.route('**/src/init/supabase-client.js*', (route) =>
      route.fulfill({
        body: `
          const state = {
            user: null,
            session: null,
          };
          try {
            state.user = JSON.parse(sessionStorage.getItem("mockUser"));
          } catch {}
          try {
            state.session = JSON.parse(sessionStorage.getItem("mockSession"));
          } catch {}

          const supabase = {
            auth: {
              storage: window.sessionStorage,
              onAuthStateChange: () => {},
              getSession: async () => ({
                data: { session: state.session },
                error: null,
              }),
              getUser: async () => ({
                data: { user: state.user },
                error: null,
              }),
              signInWithPassword: async ({ email }) => {
                state.user = { id: "1", email };
                state.session = {};
                try {
                  sessionStorage.setItem("mockUser", JSON.stringify(state.user));
                  sessionStorage.setItem("mockSession", JSON.stringify(state.session));
                } catch {}
                return {
                  data: { user: state.user, session: state.session },
                  error: null,
                };
              },
              setSession: async (session) => {
                state.session = session;
                try {
                  sessionStorage.setItem("mockSession", JSON.stringify(state.session));
                } catch {}
                return { data: { session: state.session }, error: null };
              },
              signOut: async () => {
                state.user = null;
                state.session = null;
                try {
                  sessionStorage.removeItem("mockUser");
                  sessionStorage.removeItem("mockSession");
                } catch {}
                return { error: null };
              },
              updateUser: async () => ({
                data: { user: state.user },
                error: null,
              }),
            },
            from: () => ({
              select() {
                return this;
              },
              eq() {
                return this;
              },
              contains() {
                return this;
              },
              limit: async () => ({ data: [] }),
            }),
          };
          export function registerAuthListener() {}
          export default supabase;
        `,
        contentType: 'application/javascript',
      }),
    );
    await page.route('**/supabase.co/**', (route) =>
      route.fulfill({
        status: 200,
        body: '{}',
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  test('redirects to account after login', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.getByText('Unable to load data')).toHaveCount(0);
    await page.fill('[data-testid="login-username"]', 'user@example.com');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/account.html');
    await expect(page).toHaveURL(/account\.html$/);
    await expect(page.locator('h1')).toHaveText('Account');
  });
});
