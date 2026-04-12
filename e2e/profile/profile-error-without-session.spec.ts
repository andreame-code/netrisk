const { test, expect } = require("@playwright/test");

test("profile page shows a clear error state when no session is available", async ({ page }) => {
  await page.goto('/profile.html');

  await expect(page.getByTestId('player-profile-shell')).toBeVisible();
  await expect(page.locator('#profile-feedback')).toBeVisible();
  await expect(page.locator('#profile-feedback')).toContainText('Accedi prima di consultare il profilo giocatore.');
  await expect(page.locator('#auth-status')).toContainText('Sessione non disponibile.');
  await expect(page.locator('#profile-name')).toContainText('Profilo non disponibile');
  await expect(page.locator('#logout-button')).toBeHidden();
  await expect(page.locator('#profile-content')).toHaveAttribute('hidden', '');
});


