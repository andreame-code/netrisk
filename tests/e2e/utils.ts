import { Page, expect } from '@playwright/test';

export async function authenticate(page: Page) {
  await page.goto('/login.html');
  await expect(page.getByText('Unable to load data')).toHaveCount(0);
  await expect(page.locator('[data-testid="login-username"]')).toBeVisible();
  await page.fill('[data-testid="login-username"]', 'user@example.com');
  await page.fill('[data-testid="login-password"]', 'password');
  await page.click('[data-testid="login-submit"]');
}

export async function setupLobby(
  page: Page,
  players = [
    { name: 'Red', color: '#f00' },
    { name: 'Blue', color: '#00f' },
  ],
) {
  await page.addInitScript((ps) => {
    window.localStorage.setItem('netriskPlayers', JSON.stringify(ps));
    window.localStorage.setItem('netriskMap', 'map3');
  }, players);
}
