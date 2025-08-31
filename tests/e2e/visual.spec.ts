import { test, expect } from '@playwright/test';

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
    await page.route('**/supabase.co/**', route => {
      route.fulfill({ status: 200, body: '{}', headers: { 'content-type': 'application/json' } });
    });
  });

  const pages = [
    { path: '/index.html', name: 'home' },
    { path: '/lobby.html', name: 'lobby' },
    {
      path: '/game.html',
      name: 'game',
      setup: async (page: any) => {
        await page.evaluate(() => {
          localStorage.setItem('netriskPlayers', JSON.stringify([{ name: 'Red', color: '#f00' }]));
          localStorage.setItem('netriskMap', 'map3');
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
      await expect(page).toHaveScreenshot(`${p.name}.png`);
    });
  }
});
