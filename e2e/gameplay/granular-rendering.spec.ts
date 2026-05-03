const { test, expect } = require("@playwright/test");
const {
  getReinforcementCount,
  queueNextAttackRolls,
  registerLoginAndJoin,
  resetGame,
  uniqueUser
} = require("../support/game-helpers");

async function loadGameState(page, sessionToken, gameId) {
  const stateResponse = await page.request.get(`/api/state?gameId=${encodeURIComponent(gameId)}`, {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` }
  });
  await expect(stateResponse.ok()).toBeTruthy();
  return stateResponse.json();
}

function findAttackPairFromState(state) {
  const currentPlayerId = state.currentPlayerId;
  const territories = Array.isArray(state.map) ? state.map : [];
  const territoriesById = new Map(territories.map((territory) => [territory.id, territory]));

  for (const territory of territories) {
    if (territory.ownerId !== currentPlayerId) {
      continue;
    }

    const target = territory.neighbors
      .map((neighborId) => territoriesById.get(neighborId))
      .find((neighbor) => neighbor && neighbor.ownerId !== currentPlayerId);

    if (target) {
      return {
        fromId: territory.id,
        toId: target.id
      };
    }
  }

  throw new Error("Nessuna coppia attacco valida trovata nello stato pubblico.");
}

async function exhaustReinforcements(page) {
  const reinforceButton = page.getByRole("button", { name: "Aggiungi" });
  await expect(page.getByTestId("status-summary")).toContainText(
    /Rinforzi disponibili:\s*[1-9]\d*/i
  );

  for (;;) {
    const reinforcementCount = await getReinforcementCount(page);
    if (reinforcementCount <= 0) {
      break;
    }

    await reinforceButton.click();
    await expect.poll(async () => getReinforcementCount(page)).toBe(reinforcementCount - 1);
  }

  await expect(page.locator("#attack-group")).toBeVisible();
}

async function captureStableRefs(page) {
  await expect(page.locator("#players .player-card")).toHaveCount(2);

  await page.evaluate(() => {
    (window as any).__granularRenderRefs = {
      firstPlayerCard: document.querySelector("#players .player-card"),
      secondPlayerCard: document.querySelectorAll("#players .player-card")[1] || null
    };
  });
}

async function waitForSelectedReinforcementTerritory(page) {
  await expect(page.locator("#reinforce-select")).toBeVisible();
  await page.waitForFunction(() => {
    const select = document.querySelector("#reinforce-select");
    if (!(select instanceof HTMLSelectElement)) {
      return false;
    }

    return Boolean(select.value || select.options[0]?.value);
  });

  return page
    .locator("#reinforce-select")
    .evaluate((select: HTMLSelectElement) => select.value || select.options[0]?.value || "");
}

async function expectStableRefs(page) {
  const refs = await page.evaluate(() => {
    const stored = (window as any).__granularRenderRefs || {};
    return {
      firstPlayerCard: stored.firstPlayerCard === document.querySelector("#players .player-card"),
      secondPlayerCard:
        stored.secondPlayerCard === (document.querySelectorAll("#players .player-card")[1] || null)
    };
  });

  expect(refs.firstPlayerCard).toBeTruthy();
  expect(refs.secondPlayerCard).toBeTruthy();
}

test("reinforcement keeps unrelated gameplay panels mounted", async ({ browser }) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("gr1");
  const secondUser = uniqueUser("gr2");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  await expect(firstPage.getByTestId("status-summary")).toContainText(/Rinforzi disponibili:/i);

  const selectedTerritory = await waitForSelectedReinforcementTerritory(firstPage);
  if (!selectedTerritory) {
    throw new Error("Nessun territorio disponibile per il test di rinforzo.");
  }
  const reinforcementCount = await getReinforcementCount(firstPage);
  await captureStableRefs(firstPage);

  await firstPage.getByRole("button", { name: "Aggiungi" }).click();

  await expect(firstPage.getByTestId("status-summary")).toContainText(
    new RegExp(`Rinforzi disponibili:\\s*${reinforcementCount - 1}`)
  );
  await expect(firstPage.locator("#reinforce-select")).toHaveValue(selectedTerritory);
  await expectStableRefs(firstPage);

  await firstContext.close();
  await secondContext.close();
});

test("attack preserves selected controls and skips unrelated rerenders", async ({ browser }) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("ga1");
  const secondUser = uniqueUser("ga2");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  const firstJoin = await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();
  const gameState = await loadGameState(firstPage, firstJoin.sessionToken, firstJoin.gameId);
  const attackPair = findAttackPairFromState(gameState);
  await firstPage.locator("#reinforce-select").selectOption(attackPair.fromId);
  await exhaustReinforcements(firstPage);

  const attackFrom = attackPair.fromId;
  const attackTo = attackPair.toId;

  await firstPage.locator("#attack-from").selectOption(attackFrom);
  await firstPage.locator("#attack-to").selectOption(attackTo);
  await firstPage.locator("#attack-dice").selectOption("1");
  await captureStableRefs(firstPage);

  await queueNextAttackRolls(firstPage, 1, 6);
  await firstPage.getByRole("button", { name: "Lancia attacco" }).click();

  await expect(firstPage.locator("#combat-result-group")).toBeVisible();
  await expect(firstPage.locator("#attack-from")).toHaveValue(attackFrom);
  await expect(firstPage.locator("#attack-to")).toHaveValue(attackTo);
  await expect(firstPage.locator("#attack-dice")).toHaveValue("1");
  await expectStableRefs(firstPage);

  await firstContext.close();
  await secondContext.close();
});

test("SSE handoff updates controls on the next player without recreating stable sections", async ({
  browser
}) => {
  test.slow();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const firstUser = uniqueUser("gs1");
  const secondUser = uniqueUser("gs2");

  await resetGame(firstPage);
  await firstPage.goto("/");
  await secondPage.goto("/");

  await registerLoginAndJoin(firstPage, firstUser);
  await registerLoginAndJoin(secondPage, secondUser);

  await firstPage.getByRole("button", { name: "Avvia partita" }).click();

  await captureStableRefs(secondPage);
  await exhaustReinforcements(firstPage);
  await firstPage.locator("#end-turn-button").click();
  await expect(firstPage.locator("#fortify-group")).toBeVisible();
  await firstPage.locator("#end-turn-button").click();

  await expect(secondPage.getByRole("button", { name: "Aggiungi" })).toBeEnabled({
    timeout: 10000
  });
  await expect(secondPage.locator("#reinforce-group")).toBeVisible({ timeout: 10000 });
  await expectStableRefs(secondPage);

  await firstContext.close();
  await secondContext.close();
});
