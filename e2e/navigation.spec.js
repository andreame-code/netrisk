const { test, expect } = require('@playwright/test');

const HOME_URL = 'http://localhost:3000/index.html';

test.describe('navigation flows', () => {
  test('Home → Setup → Game → Exit → Home', async ({ page }) => {
    await page.goto(HOME_URL);
    await expect(page.locator('#playBtn')).toBeVisible();
    await expect(page.locator('#setupBtn')).toBeVisible();
    await expect(page.locator('#howToPlayBtn')).toBeVisible();
    await expect(page.locator('#aboutBtn')).toBeVisible();
    await expect(page.locator('#setupForm')).toHaveCount(0);

    await page.click('#setupBtn');
    await expect(page.locator('#setupForm')).toBeVisible();
    await expect(page.locator('#playBtn')).toHaveCount(0);

    await page.click('text=Start');
    await expect(page.locator('#exitGame')).toBeVisible();
    await expect(page.locator('#setupForm')).toHaveCount(0);

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#exitGame'),
    ]);
    await dialog.accept();

    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator('#setupBtn')).toBeVisible();
  });

  test('Home → HowTo → Back', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.click('#howToPlayBtn');
    await expect(page.locator('h1')).toHaveText('How to Play');
    await expect(page.locator('#playBtn')).toHaveCount(0);
    await page.click('header >> text=Home');
    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator('#aboutBtn')).toBeVisible();
  });

  test('Home → About → Back', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.click('#aboutBtn');
    await expect(page.locator('#pageTitle')).toBeVisible();
    await expect(page.locator('#playBtn')).toHaveCount(0);
    await page.click('header >> text=Home');
    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator('#setupBtn')).toBeVisible();
  });
});
