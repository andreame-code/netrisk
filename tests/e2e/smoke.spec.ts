import { test, expect } from '@playwright/test';

test.describe('smoke flow', () => {
  test.beforeEach(async ({ page }) => {
    // disable animations
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
    // mock supabase network
    await page.route('**/supabase.co/**', (route) => {
      route.fulfill({
        status: 200,
        body: '{}',
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  test('login, lobby, start game', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.getByText('Unable to load data')).toHaveCount(0);
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
    await page.fill('[data-testid="login-email"]', 'user@example.com');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');

    await page.goto('/lobby.html');
    await expect(page.getByText('Unable to load data')).toHaveCount(0);
    await page.evaluate(() => {
      localStorage.setItem('netriskPlayers', JSON.stringify([{ name: 'Red', color: '#f00' }]));
      localStorage.setItem('netriskMap', 'map3');
    });
    await page.goto('/game.html');
    await expect(page.getByText('Unable to load data')).toHaveCount(0);
    await expect(page.locator('[data-testid="load-error"]')).toBeHidden();
    await page.waitForSelector('[data-testid="game-board"] .map-territory');
  });
});
