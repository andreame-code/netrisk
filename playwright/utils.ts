import { Page, expect } from '@playwright/test';

export async function assertLoggedInUI(page: Page) {
  await expect(page.getByTestId('profile-link')).toBeVisible();
  await expect(page.getByTestId('lobby-link')).toBeVisible();
  await expect(page.getByTestId('logout-btn')).toBeVisible();
  await expect(page.getByTestId('login-btn')).toHaveCount(0);
}

export async function assertLoggedOutUI(page: Page) {
  await expect(page.getByTestId('login-btn')).toBeVisible();
  await expect(page.getByTestId('logout-btn')).toHaveCount(0);
  await expect(page.getByTestId('profile-link')).toHaveCount(0);
}

export async function login(page: Page, email = 'user@example.com', password = 'password') {
  await page.goto('/login.html');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

export async function mockSupabase(page: Page) {
  await page.route('**/src/init/supabase-client.js*', (route) =>
    route.fulfill({
      body: `
        let storedUser = null;
        let storedSession = null;
        try {
          storedUser = JSON.parse(sessionStorage.getItem('mockUser'));
          storedSession = JSON.parse(sessionStorage.getItem('mockSession'));
        } catch {}
        const state = { user: storedUser, session: storedSession };
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
