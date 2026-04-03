const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const outsiderPage = await outsiderContext.newPage();

  function unique(prefix) {
    return prefix + '_' + Date.now().toString(36).slice(-6) + Math.random().toString(16).slice(2, 4);
  }

  const ownerUser = unique('owner');
  const outsiderUser = unique('outsider');
  const gameName = unique('protetta');

  await ownerPage.request.post('http://127.0.0.1:3100/api/test/reset');
  await ownerPage.goto('http://127.0.0.1:3100/game.html');
  await ownerPage.getByPlaceholder('Utente').fill(ownerUser);
  await ownerPage.getByPlaceholder('Password').fill('secret123');
  await ownerPage.getByRole('button', { name: 'Registrati' }).click();
  await ownerPage.goto('http://127.0.0.1:3100/lobby.html');
  await ownerPage.locator('#create-game-button').click();
  await ownerPage.locator('#setup-game-name').fill(gameName);
  await ownerPage.getByRole('button', { name: 'Crea e apri' }).click();
  const ownerUrl = ownerPage.url();

  await outsiderPage.goto('http://127.0.0.1:3100/game.html');
  await outsiderPage.getByPlaceholder('Utente').fill(outsiderUser);
  await outsiderPage.getByPlaceholder('Password').fill('secret123');
  await outsiderPage.getByRole('button', { name: 'Registrati' }).click();

  outsiderPage.on('dialog', async (dialog) => {
    console.log('DIALOG:', dialog.message());
    await dialog.dismiss();
  });
  outsiderPage.on('pageerror', (error) => console.log('PAGEERROR:', error.message));
  outsiderPage.on('console', (msg) => console.log('CONSOLE:', msg.type(), msg.text()));

  await outsiderPage.goto(ownerUrl);
  await outsiderPage.waitForTimeout(5000);

  console.log('OUTSIDER URL', outsiderPage.url());
  console.log('GAME STATUS', await outsiderPage.locator('#game-status').textContent().catch(() => '<missing>'));
  console.log('STATUS SUMMARY', await outsiderPage.getByTestId('status-summary').textContent().catch(() => '<missing>'));
  console.log('AUTH STATUS', await outsiderPage.locator('#auth-status').textContent().catch(() => '<missing>'));

  await browser.close();
})();
