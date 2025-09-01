import { test, expect } from "@playwright/test";

test.describe("UAT checklist", () => {
  test.describe.configure({ timeout: 120000 });

  test("@smoke basic gameplay flow", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "netriskPlayers",
        JSON.stringify([
          { name: "Red", color: "#f00" },
          { name: "Blue", color: "#00f" },
        ]),
      );
      // Use the simple grid map so the test can interact with a predictable set of territories.
      localStorage.setItem("netriskMap", "map3");
    });

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/game.html");
    await page.waitForSelector("#board .map-territory", { timeout: 60000 });
    const terrs = await page.$$eval("#board .map-territory", (els) =>
      els.slice(0, 3).map((el) => `#${el.id}`),
    );
    for (const sel of terrs) {
      const boardSel = `#board .map-territory${sel}`;
      await page.evaluate((s) => {
        const el = document.querySelector(s);
        el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }, boardSel);
      const name = await page.getAttribute(boardSel, "data-name");
      await expect(page.locator(boardSel)).toHaveClass(/selected/);
      await expect(page.locator("#selectedTerritory")).toHaveText(name!);
    }
    await page.evaluate(async () => {
      const mod = await import("/src/main.js");
      mod.game.reinforcements = 0;
      mod.game.phase = "attack";
      const ui = await import("/src/ui.js");
      ui.updateUI();
    });

    const turnBefore = await page.locator("#turnNumber").textContent();
    await page.click("#endTurn");
    await page.click("#endTurn");
    await expect(page.locator("#turnNumber")).not.toHaveText(turnBefore!);
    await expect(page.locator("#actionLog")).toContainText("ends turn");

    expect(errors).toEqual([]);
  });

  test("@smoke level 3 extras", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "netriskPlayers",
        JSON.stringify([
          { name: "Red", color: "#f00" },
          { name: "Blue", color: "#00f" },
        ]),
      );
      localStorage.setItem("netriskMap", "map3");
    });

    await page.goto("/game.html");
    // Wait for at least one territory to load so the accessibility hooks run.
    await page.waitForSelector("#board .map-territory", { timeout: 60000 });

    // These accessibility classes are applied asynchronously after game init,
    // so allow extra time for slower environments.
    await expect(page.locator("body")).toHaveClass(/high-contrast/, {
      timeout: 15000,
    });
    await expect(page.locator("body")).toHaveClass(/jump-assist/, {
      timeout: 15000,
    });

    const hud = await page.evaluate(async () => {
      const mod = await import("/src/data/level-hud.js");
      return mod.getHudElements("map3");
    });
    expect(hud.starDust).toBeTruthy();
    expect(hud.crystalKey).toBeTruthy();
    expect(hud.powerUps).toBeTruthy();

    const music = await page.evaluate(async () => {
      const mod = await import("/src/audio.js");
      return mod.getLevelMusic("map3");
    });
    expect(music).toContain("fairy-music");
  });
});
