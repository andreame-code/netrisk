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
