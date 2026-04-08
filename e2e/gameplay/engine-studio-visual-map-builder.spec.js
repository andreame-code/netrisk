const { test, expect } = require("@playwright/test");
const { registerAndLogin, resetGame, uniqueUser } = require("../support/game-helpers.js");

async function clickBoardAt(page, ratioX, ratioY) {
  const board = page.locator("#engine-map-board");
  const box = await board.boundingBox();
  if (!box) {
    throw new Error("Board non disponibile");
  }

  await page.mouse.click(box.x + (box.width * ratioX), box.y + (box.height * ratioY));
}

test("visual map builder permette piazzamento, drag e link dei territori mantenendo l'API invariata", async ({ page }) => {
  test.slow();

  await resetGame(page);
  await page.goto("/game.html");
  await registerAndLogin(page, uniqueUser("visual_map"));
  await page.goto("/engine.html");

  const suffix = Date.now().toString(36).slice(-5);
  const mapName = `Visual Frontier ${suffix}`;
  const rulesetName = `Visual Ruleset ${suffix}`;

  await page.locator("#engine-map-name").fill(mapName);
  await page.locator("#engine-map-add-continent").click();
  await page.locator("#engine-continent-name").fill("Heartlands");
  await page.locator("#engine-continent-bonus").fill("3");

  await page.locator("#engine-map-add-territory").click();
  await clickBoardAt(page, 0.24, 0.28);
  await page.locator("#engine-territory-name").fill("Citadel");
  await page.locator("#engine-territory-continent").selectOption("continent-1");

  await page.locator("#engine-map-add-territory").click();
  await clickBoardAt(page, 0.69, 0.67);
  await page.locator("#engine-territory-name").fill("Sunkeep");
  await page.locator("#engine-territory-continent").selectOption("continent-1");

  const targetNode = page.locator('[data-territory-id="territory-2"]').first();
  const nodeBox = await targetNode.boundingBox();
  if (!nodeBox) {
    throw new Error("Nodo territory-2 non disponibile");
  }

  await page.mouse.move(nodeBox.x + (nodeBox.width / 2), nodeBox.y + (nodeBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(nodeBox.x + 140, nodeBox.y - 80, { steps: 12 });
  await page.mouse.up();

  await page.locator("#engine-map-territory-list").getByRole("button", { name: "Citadel" }).click();
  await page.locator('[data-neighbor-id="territory-2"]').check();

  await page.locator("#engine-map-save").click();
  await expect(page.locator("#engine-feedback")).toContainText("Mappa salvata.");

  const mapsResponse = await page.request.get("/api/engine/maps");
  await expect(mapsResponse.ok()).toBeTruthy();
  const mapsPayload = await mapsResponse.json();
  const savedMap = mapsPayload.maps.find((map) => map.name === mapName);
  expect(savedMap).toBeTruthy();
  expect(savedMap.territories).toHaveLength(2);
  expect(savedMap.continents[0].territoryIds.sort()).toEqual(["territory-1", "territory-2"]);
  expect(savedMap.territories.find((territory) => territory.id === "territory-1").neighbors).toContain("territory-2");
  expect(savedMap.positions["territory-2"].x).toBeGreaterThan(70);

  await page.locator("#engine-ruleset-name").fill(rulesetName);
  await page.locator("#engine-ruleset-map").selectOption(savedMap.id);
  await page.locator("#engine-ruleset-piece-theme").selectOption("classic-commanders");
  await page.locator("#engine-ruleset-victory").selectOption("domination");
  await page.locator("#engine-ruleset-combat").selectOption("standard");
  await page.locator("#engine-ruleset-save").click();
  await expect(page.locator("#engine-feedback")).toContainText("Ruleset salvato.");

  await page.goto("/new-game.html");
  await page.locator("#setup-ruleset").selectOption({ label: rulesetName });
  await page.locator("#setup-game-name").fill(`Visual Match ${suffix}`);
  await page.getByRole("button", { name: "Crea e apri" }).click();

  await expect(page).toHaveURL(/\/game(\/|\.html\?gameId=)/);
  await expect(page.locator("#game-map-meta")).toContainText(mapName);
  await expect(page.locator('[data-territory-id="territory-1"]')).toBeVisible();
  await expect(page.locator('[data-territory-id="territory-2"]')).toBeVisible();
});
