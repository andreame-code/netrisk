import { test, expect } from '@playwright/test';
import { WebSocketServer } from 'ws';

const WS_PORT = 3456;

test.describe('lobby creation', () => {
  let wss;

  test.beforeAll(() => {
    wss = new WebSocketServer({ port: WS_PORT });
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(String(data));
        } catch {
          return;
        }
        if (msg.type === 'createLobby') {
          const id = msg.player?.id || 'p1';
          ws.send(
            JSON.stringify({
              type: 'lobby',
              code: '1',
              host: id,
              maxPlayers: msg.maxPlayers,
              map: msg.map,
              players: [{ id, name: msg.player?.name }],
            }),
          );
        }
      });
    });
  });

  test.afterAll(() => {
    wss.close();
  });

  test('user can create a lobby', async ({ page }) => {
    await page.route('**/src/config.js', (route) =>
      route.fulfill({
        body: `
          export const API_BASE_URL = "";
          export const SUPABASE_URL = "http://localhost:9999";
          export const SUPABASE_KEY = "anon";
          export const ENV_STAMP = "";
          export const ENV_SHA = "";
          export const WS_URL = "ws://localhost:${WS_PORT}";
        `,
        contentType: 'application/javascript',
      }),
    );

    await page.route('**/src/init/supabase-client.js*', (route) =>
      route.fulfill({
        body: `
          const lobbies = [];
          let currentUser = null;
          const supabase = {
            auth: {
              storage: window.sessionStorage,
              async signInWithPassword({ email }) {
                currentUser = { id: "u1", email, user_metadata: { name: email.split("@")[0] } };
                return { data: { user: currentUser, session: { access_token: "token", user: currentUser } }, error: null };
              },
              async setSession(session) {
                this.storage.setItem("session", JSON.stringify(session));
                return { data: { session } };
              },
              async signOut() {
                currentUser = null;
                window.sessionStorage.removeItem("session");
                window.localStorage.removeItem("session");
              },
              async getSession() {
                const raw =
                  window.sessionStorage.getItem("session") ||
                  window.localStorage.getItem("session");
                const session = raw ? JSON.parse(raw) : null;
                if (session?.user) currentUser = session.user;
                return { data: { session }, error: null };
              },
              async getUser() {
                return { data: { user: currentUser }, error: null };
              },
              onAuthStateChange() {},
            },
            from(table) {
              if (table !== "lobbies") return {};
              return {
                async select() {
                  return { data: lobbies, error: null };
                },
                insert(row) {
                  const newLobby = { ...row, id: String(lobbies.length + 1), code: String(lobbies.length + 1) };
                  lobbies.push(newLobby);
                  return {
                    select() { return this; },
                    async single() { return { data: newLobby, error: null }; },
                  };
                },
              };
            },
          };
          export { supabase };
          export function registerAuthListener() {}
          export default supabase;
        `,
        contentType: 'application/javascript',
      }),
    );

    await page.route('**/assets/maps/map-manifest.json', (route) =>
      route.fulfill({
        body: JSON.stringify({ maps: [{ id: 'map1', name: 'Map 1' }] }),
        contentType: 'application/json',
      }),
    );
    await page.route('**/public/assets/maps/map-manifest.json', (route) =>
      route.fulfill({
        body: JSON.stringify({ maps: [{ id: 'map1', name: 'Map 1' }] }),
        contentType: 'application/json',
      }),
    );

    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });

    await page.goto('/login.html');
    await expect(page.getByText('Unable to load data')).toHaveCount(0);
    await page.fill('[data-testid="login-username"]', 'testuser@example.com');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');

    await page.goto('/lobby.html');
    await expect(page.getByText('Unable to load data')).toHaveCount(0);
    const list = page.locator('[data-testid="lobby-list"] li');
    await expect(list).toHaveCount(0);

    await page.click('[data-testid="create-game"]');
    await page.fill('#roomName', 'Test Lobby');
    await page.fill('#maxPlayers', '3');
    await page.selectOption('#map', 'map1');
    await page.click('#submitCreate');

    await expect(list).toHaveCount(1);
    await expect(page.locator('[data-testid="lobby-list"]')).toContainText('host: p1');
  });
});
