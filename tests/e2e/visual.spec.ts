import { test, expect } from '@playwright/test';

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__env = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'dummy-key',
      };
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
      const now = Date.now();
      Date.now = () => now;
      Math.random = () => 0.42;
      performance.now = () => now;
      const cryptoObj = window.crypto || (window.crypto = {} as any);
      cryptoObj.getRandomValues = (arr: any) => {
        if (Array.isArray(arr) || ArrayBuffer.isView(arr)) {
          arr.fill(0);
          return arr;
        }
        return arr;
      };
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(now), 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = (fn, t) => originalSetTimeout(fn, 0);
      window.setInterval = () => 0;
    });
    await page.route('**/supabase.co/**', (route) => {
      route.fulfill({
        status: 200,
        body: '{}',
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  const pages = [
    { path: '/index.html', name: 'home' },
    { path: '/lobby.html', name: 'lobby' },
    {
      path: '/game.html',
      name: 'game',
      setup: async (page: any) => {
        await page.addInitScript(() => {
          window.localStorage.setItem(
            'netriskPlayers',
            JSON.stringify([{ name: 'Red', color: '#f00' }]),
          );
          window.localStorage.setItem('netriskMap', 'map3');
        });
      },
    },
  ];

  for (const p of pages) {
    test(`${p.name} page`, async ({ page }) => {
      if (p.setup) await p.setup(page);
      await page.goto(p.path);
      await expect(page.getByText('Unable to load data')).toHaveCount(0);
      if (p.name === 'game') {
        await page.waitForSelector('[data-testid="game-board"] .map-territory');
      }
      await page.evaluate(() => document.fonts.ready);
      const screenshot = await page.screenshot();
      expect(screenshot.toString('base64')).toMatchSnapshot(`${p.name}.txt`);
    });
  }
});
