const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

function buildCustomMapPayload(nameSuffix) {
  return {
    name: `Frontiera ${nameSuffix}`,
    territories: [
      { id: "north_gate", name: "North Gate", continentId: "crown", neighbors: ["river_hold", "iron_woods"] },
      { id: "river_hold", name: "River Hold", continentId: "crown", neighbors: ["north_gate", "sun_fields"] },
      { id: "iron_woods", name: "Iron Woods", continentId: "wilds", neighbors: ["north_gate", "sun_fields"] },
      { id: "sun_fields", name: "Sun Fields", continentId: "wilds", neighbors: ["river_hold", "iron_woods"] }
    ],
    continents: [
      { id: "crown", name: "Crownlands", bonus: 2, territoryIds: ["north_gate", "river_hold"] },
      { id: "wilds", name: "Wild Marches", bonus: 2, territoryIds: ["iron_woods", "sun_fields"] }
    ],
    positions: {
      north_gate: { x: 24, y: 22 },
      river_hold: { x: 59, y: 28 },
      iron_woods: { x: 28, y: 68 },
      sun_fields: { x: 68, y: 72 }
    }
  };
}

async function saveMapDraft(page, payload) {
  await page.locator("#engine-map-name").fill(payload.name);
  await page.locator("#engine-map-aspect-width").fill("16");
  await page.locator("#engine-map-aspect-height").fill("9");
  const advanced = page.locator(".engine-map-advanced");
  if (!(await advanced.evaluate((element) => element.hasAttribute("open")))) {
    await advanced.locator("summary").click();
  }
  await page.locator("#engine-map-territories").fill(JSON.stringify(payload.territories, null, 2));
  await page.locator("#engine-map-continents").fill(JSON.stringify(payload.continents, null, 2));
  await page.locator("#engine-map-positions").fill(JSON.stringify(payload.positions, null, 2));
  await page.locator("#engine-map-save").click();
  await expect(page.locator("#engine-feedback")).toContainText("Mappa salvata.");
}

async function saveVictoryRuleDraft(page, payload) {
  await page.locator("#engine-victory-name").fill(payload.name);
  await page.locator("#engine-victory-module").selectOption(payload.moduleId);
  await page.locator("#engine-victory-description").fill(payload.description);
  await page.locator("#engine-victory-config").fill(JSON.stringify(payload.config, null, 2));
  await page.locator("#engine-victory-save").click();
  await expect(page.locator("#engine-feedback")).toContainText("Regola vittoria salvata.");
}

test("engine studio gestisce CRUD completo di mappe e victory rules custom", async ({ page }) => {
  test.slow();

  await resetGame(page);
  await page.goto("/game.html");
  await registerAndLogin(page, uniqueUser("engine_crud"));

  const suffix = Date.now().toString(36).slice(-5);
  const mapDraft = buildCustomMapPayload(suffix);
  const updatedMapName = `Frontiera ${suffix} Prime`;
  const victoryName = `Conquista Lampo ${suffix}`;
  const updatedVictoryName = `Conquista Lampo ${suffix} Prime`;
  const rulesetName = `Ruleset Frontiera ${suffix}`;

  await page.goto("/engine.html");
  await expect(page.locator("#engine-map-name")).toBeVisible();

  await saveMapDraft(page, mapDraft);
  await page.locator("#engine-map-select").selectOption({ label: mapDraft.name });
  await expect(page.locator("#engine-map-name")).toHaveValue(mapDraft.name);

  await page.locator("#engine-map-name").fill(updatedMapName);
  await page.locator("#engine-map-save").click();
  await expect(page.locator("#engine-feedback")).toContainText("Mappa salvata.");

  const mapsResponse = await page.request.get("/api/engine/maps");
  await expect(mapsResponse.ok()).toBeTruthy();
  const mapsPayload = await mapsResponse.json();
  const savedMap = mapsPayload.maps.find((map) => map.name === updatedMapName);
  expect(savedMap).toBeTruthy();
  expect(savedMap.territories).toHaveLength(4);

  await saveVictoryRuleDraft(page, {
    name: victoryName,
    moduleId: "capture-territories",
    description: "Vinci controllando tre territori.",
    config: {
      targetTerritoryCount: 3
    }
  });
  await page.locator("#engine-victory-select").selectOption({ label: victoryName });
  await expect(page.locator("#engine-victory-name")).toHaveValue(victoryName);

  await page.locator("#engine-victory-name").fill(updatedVictoryName);
  await page.locator("#engine-victory-description").fill("Vinci controllando tre territori aggiornati.");
  await page.locator("#engine-victory-config").fill(JSON.stringify({ targetTerritoryCount: 3 }, null, 2));
  await page.locator("#engine-victory-save").click();
  await expect(page.locator("#engine-feedback")).toContainText("Regola vittoria salvata.");

  const victoryRulesResponse = await page.request.get("/api/engine/victory-rules");
  await expect(victoryRulesResponse.ok()).toBeTruthy();
  const victoryRulesPayload = await victoryRulesResponse.json();
  const savedVictoryRule = victoryRulesPayload.victoryRules.find((rule) => rule.name === updatedVictoryName);
  expect(savedVictoryRule).toBeTruthy();
  expect(savedVictoryRule.config.targetTerritoryCount).toBe(3);

  await page.locator("#engine-ruleset-name").fill(rulesetName);
  await page.locator("#engine-ruleset-description").fill("Ruleset custom per la frontiera.");
  await page.locator("#engine-ruleset-map").selectOption(savedMap.id);
  await page.locator("#engine-ruleset-piece-theme").selectOption("classic-commanders");
  await page.locator("#engine-ruleset-victory").selectOption(savedVictoryRule.id);
  await page.locator("#engine-ruleset-combat").selectOption("standard-3-defense");
  await page.locator("#engine-ruleset-save").click();
  await expect(page.locator("#engine-feedback")).toContainText("Ruleset salvato.");

  await page.locator("#engine-map-select").selectOption(savedMap.id);
  await page.locator("#engine-map-delete").click();
  await expect(page.locator("#engine-feedback")).toContainText("ancora usata da un ruleset custom");

  await page.goto("/new-game.html");
  await expect(page.getByTestId("new-game-shell")).toBeVisible();
  await page.locator("#setup-ruleset").selectOption({ label: rulesetName });
  await expect(page.locator("#setup-map-details")).toContainText("4 territori");
  await page.locator("#setup-game-name").fill(`Match ${suffix}`);
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page).toHaveURL(/\/game(\/|\.html\?gameId=)/);
  await expect(page.locator("#game-map-meta")).toContainText(updatedMapName);
  await expect(page.locator('[data-territory-id="north_gate"]')).toBeVisible();
  await expect(page.locator('[data-territory-id="sun_fields"]')).toBeVisible();

  const stateResponse = await page.request.get("/api/state");
  await expect(stateResponse.ok()).toBeTruthy();
  const statePayload = await stateResponse.json();
  expect(statePayload.gameConfig.mapName).toBe(updatedMapName);
  expect(statePayload.gameConfig.victoryRuleName).toBe(updatedVictoryName);
  expect(statePayload.diceRuleSet.id).toBe("standard-3-defense");

  await page.goto("/engine.html");
  await page.locator("#engine-ruleset-select").selectOption({ label: rulesetName });
  await page.locator("#engine-ruleset-delete").click();
  await expect(page.locator("#engine-feedback")).toContainText("Ruleset custom eliminato.");

  await page.locator("#engine-map-select").selectOption(savedMap.id);
  await page.locator("#engine-map-delete").click();
  await expect(page.locator("#engine-feedback")).toContainText("Mappa custom eliminata.");

  await page.locator("#engine-victory-select").selectOption(savedVictoryRule.id);
  await page.locator("#engine-victory-delete").click();
  await expect(page.locator("#engine-feedback")).toContainText("Regola vittoria custom eliminata.");

  const finalMapsResponse = await page.request.get("/api/engine/maps");
  const finalMapsPayload = await finalMapsResponse.json();
  expect(finalMapsPayload.maps.some((map) => map.id === savedMap.id)).toBeFalsy();

  const finalVictoryRulesResponse = await page.request.get("/api/engine/victory-rules");
  const finalVictoryRulesPayload = await finalVictoryRulesResponse.json();
  expect(finalVictoryRulesPayload.victoryRules.some((rule) => rule.id === savedVictoryRule.id)).toBeFalsy();
});
