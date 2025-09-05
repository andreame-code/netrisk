import { test, expect } from '@playwright/test';

test.describe('join lobby', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
    await page.route('**/supabase.co/**', (route) => {
      route.fulfill({
        status: 200,
        body: '{}',
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  test('stores lobby info after entering code', async ({ page }) => {
    await page.goto('/lobby.html');
    await page.evaluate(() => {
      const code = 'abcd';
      return new Promise<void>((resolve) => {
        const ws = {
          send(data: string) {
            try {
              const msg = JSON.parse(data);
              if (msg.type === 'joinLobby') {
                localStorage.setItem('lobbyCode', msg.code);
                localStorage.setItem('playerId', 'p1');
              }
            } catch {
              /* ignore */
            }
            resolve();
          },
        } as unknown as WebSocket;
        ws.send(
          JSON.stringify({
            type: 'joinLobby',
            code,
            player: { name: 'tester' },
          }),
        );
      });
    });
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('lobbyCode')))
      .toBe('abcd');
    await expect(await page.evaluate(() => localStorage.getItem('playerId'))).toBe('p1');
  });
});
