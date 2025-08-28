import { test, expect } from '@playwright/test';

test.describe('UAT checklist', () => {
  test('basic gameplay flow', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('netriskPlayers', JSON.stringify([
        { name: 'Red', color: '#f00' },
        { name: 'Blue', color: '#00f' },
      ]));
      localStorage.setItem('netriskMap', 'map');
    });

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/game.html');
    await page.waitForSelector('#north-america');

    const terrs = ['#north-america', '#south-america', '#africa'];
    for (const sel of terrs) {
      await page.evaluate((s) => {
        const el = document.querySelector(s);
        el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, sel);
      const name = await page.getAttribute(sel, 'data-name');
      await expect(page.locator(sel)).toHaveClass(/selected/);
      await expect(page.locator('#selectedTerritory')).toHaveText(name!);
    }

    await page.waitForSelector('#token');
    const before = await page.locator('#token').evaluate((el) => ({
      left: (el as HTMLElement).style.left,
      top: (el as HTMLElement).style.top,
    }));
    await page.evaluate(async () => {
      const mod = await import('/src/main.js');
      const phases = await import('/src/phases.js');
      mod.game.setPhase(phases.FORTIFY);
    });
    await page.evaluate(() => document.getElementById('moveToken')?.click());
    await expect(page.locator('#actionLog')).toContainText('moves token');
    await expect(page.locator('#token')).not.toHaveCSS('left', before.left || '');
    await expect(page.locator('#token')).not.toHaveCSS('top', before.top || '');

    const turnBefore = await page.locator('#turnNumber').textContent();
    await page.click('#endTurn');
    await expect(page.locator('#turnNumber')).not.toHaveText(turnBefore!);
    await expect(page.locator('#actionLog')).toContainText('ends turn');

    expect(errors).toEqual([]);
  });

  test('level 3 extras', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('netriskPlayers', JSON.stringify([
        { name: 'Red', color: '#f00' },
        { name: 'Blue', color: '#00f' },
      ]));
      localStorage.setItem('netriskMap', 'map3');
    });

    await page.goto('/game.html');
    await page.waitForSelector('#board');

    await expect(page.locator('body')).toHaveClass(/high-contrast/);
    await expect(page.locator('body')).toHaveClass(/jump-assist/);

    const hud = await page.evaluate(async () => {
      const mod = await import('/src/data/level-hud.js');
      return mod.getHudElements('map3');
    });
    expect(hud.starDust).toBeTruthy();
    expect(hud.crystalKey).toBeTruthy();
    expect(hud.powerUps).toBeTruthy();

    const music = await page.evaluate(async () => {
      const mod = await import('/src/audio.js');
      return mod.getLevelMusic('map3');
    });
    expect(music).toContain('fairy-music');
  });
});
