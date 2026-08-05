const { test, expect } = require("@playwright/test");
const { DatabaseSync } = require("node:sqlite");

const {
  attachSessionCookie,
  createAuthenticatedSession,
  resetGame,
  uniqueUser
} = require("../support/game-helpers");

function withE2eDatabase(run) {
  const dbFile = process.env.E2E_DB_FILE;
  expect(dbFile).toBeTruthy();

  const db = new DatabaseSync(dbFile);
  try {
    return run(db);
  } finally {
    db.close();
  }
}

function promoteUserToAdmin(username) {
  withE2eDatabase((db) => {
    const result = db
      .prepare("UPDATE users SET role = 'admin' WHERE lower(username) = lower(?)")
      .run(username);
    expect(result.changes).toBe(1);
  });
}

function configureFinishedOrphanGame(gameId) {
  return withE2eDatabase((db) => {
    const row = db.prepare("SELECT state_json FROM games WHERE id = ?").get(gameId);
    expect(row).toBeTruthy();

    const state = JSON.parse(row.state_json);
    state.phase = "finished";
    state.turnPhase = "finished";
    state.gameConfig.activeModules = [
      { id: "core.base", version: "1.0.0" },
      { id: "demo.defaults", version: "1.0.0" }
    ];
    state.gameConfig.contentProfileId = "demo.defaults.content";
    state.gameConfig.gameplayProfileId = "demo.defaults.gameplay";
    state.gameConfig.uiProfileId = "demo.defaults.ui";
    state.gameConfig.scenarioSetup = {
      logMessage: "Persisted UAT scenario output",
      territoryBonuses: [{ territoryId: "aurora", armies: 1 }]
    };

    const updated = db
      .prepare("UPDATE games SET state_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(state), new Date().toISOString(), gameId);
    expect(updated.changes).toBe(1);

    return JSON.parse(
      JSON.stringify({
        players: state.players,
        territories: state.territories,
        hands: state.hands,
        turnPhase: state.turnPhase,
        currentTurnIndex: state.currentTurnIndex,
        winnerId: state.winnerId,
        versionInfo: state.versionInfo,
        scenarioSetup: state.gameConfig.scenarioSetup,
        mapId: state.gameConfig.mapId,
        contentPackId: state.gameConfig.contentPackId,
        ruleSetId: state.gameConfig.ruleSetId,
        diceRuleSetId: state.gameConfig.diceRuleSetId,
        victoryRuleSetId: state.gameConfig.victoryRuleSetId,
        themeId: state.gameConfig.themeId,
        pieceSetId: state.gameConfig.pieceSetId,
        pieceSkinId: state.gameConfig.pieceSkinId
      })
    );
  });
}

async function createGame(page, sessionToken, name) {
  const response = await page.request.post("/api/games", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` },
    data: {
      name,
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    }
  });
  await expect(response.ok()).toBeTruthy();
  return response.json();
}

function preservedStateSnapshot(state) {
  return JSON.parse(
    JSON.stringify({
      players: state.players,
      territories: state.territories,
      hands: state.hands,
      turnPhase: state.turnPhase,
      currentTurnIndex: state.currentTurnIndex,
      winnerId: state.winnerId,
      versionInfo: state.versionInfo,
      scenarioSetup: state.gameConfig.scenarioSetup,
      mapId: state.gameConfig.mapId,
      contentPackId: state.gameConfig.contentPackId,
      ruleSetId: state.gameConfig.ruleSetId,
      diceRuleSetId: state.gameConfig.diceRuleSetId,
      victoryRuleSetId: state.gameConfig.victoryRuleSetId,
      themeId: state.gameConfig.themeId,
      pieceSetId: state.gameConfig.pieceSetId,
      pieceSkinId: state.gameConfig.pieceSkinId
    })
  );
}

test("admin safely previews, repairs, and audits a finished orphaned game", async ({ page }) => {
  await resetGame(page);

  const adminUsername = uniqueUser("admin_orphan_uat");
  const sessionToken = await createAuthenticatedSession(page, adminUsername);
  promoteUserToAdmin(adminUsername);

  const gameName = uniqueUser("orphan_repair_uat");
  const createdGame = await createGame(page, sessionToken, gameName);
  const gameId = createdGame.game.id;
  const preservedBefore = configureFinishedOrphanGame(gameId);

  await createGame(page, sessionToken, uniqueUser("active_cache_uat"));
  await attachSessionCookie(page, sessionToken);

  const maintenanceBefore = await page.request.get("/api/admin/maintenance", {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` }
  });
  await expect(maintenanceBefore.ok()).toBeTruthy();
  const maintenanceBeforePayload = await maintenanceBefore.json();
  expect(maintenanceBeforePayload.summary.orphanedModuleReferences).toBe(1);
  expect(maintenanceBeforePayload.summary.invalidGames).toBe(1);

  await page.goto("/admin/games");
  await expect(page.getByTestId("admin-route-page")).toBeVisible();
  await page.getByPlaceholder("Search games...").fill(gameName);
  await page.getByRole("button", { name: new RegExp(gameName) }).click();

  const preview = page.getByTestId("admin-game-repair-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("safe");
  await expect(preview).toContainText("Unavailable modules: demo.defaults");
  await expect(preview).toContainText(
    "Related profiles: demo.defaults.content, demo.defaults.gameplay, demo.defaults.ui"
  );
  await expect(preview).toContainText("gameConfig.activeModules");
  await expect(preview).toContainText("gameConfig.contentProfileId");
  await expect(preview).toContainText("gameConfig.gameplayProfileId");
  await expect(preview).toContainText("gameConfig.uiProfileId");
  await expect(preview).toContainText("winner and version metadata");

  const repairButton = page.getByRole("button", { name: "Apply safe repair" });
  await expect(repairButton).toBeEnabled();
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    expect(dialog.message()).toBe(`Type ${gameId} to confirm repair-game-config.`);
    await dialog.accept(gameId);
  });
  await repairButton.click();

  await expect(page.getByRole("heading", { name: "Game action completed" })).toBeVisible();
  await expect(repairButton).toBeDisabled();

  const detailsResponse = await page.request.get(`/api/admin/games/${encodeURIComponent(gameId)}`, {
    headers: { Cookie: `netrisk_session=${encodeURIComponent(sessionToken)}` }
  });
  await expect(detailsResponse.ok()).toBeTruthy();
  const details = await detailsResponse.json();
  expect(details.repairPreview.status).toBe("not-needed");
  expect(details.game.issueCount).toBe(0);
  expect(details.rawState.gameConfig.activeModules).toEqual([
    { id: "core.base", version: "1.0.0" }
  ]);
  expect(details.rawState.gameConfig.contentProfileId).toBeNull();
  expect(details.rawState.gameConfig.gameplayProfileId).toBeNull();
  expect(details.rawState.gameConfig.uiProfileId).toBeNull();
  expect(preservedStateSnapshot(details.rawState)).toEqual(preservedBefore);

  await page.goto("/admin/maintenance");
  await expect(page.getByText("No maintenance issues detected.")).toBeVisible();
  await expect(page.getByText("Orphaned module refs").locator("..").locator("..")).toContainText(
    "0"
  );
  await expect(page.getByText("Invalid games").locator("..").locator("..")).toContainText("0");

  await page.goto("/admin/system-health");
  await expect(page.getByText("Module references", { exact: true }).locator("..")).toContainText(
    "OK"
  );
  await expect(page.getByText("Game snapshots", { exact: true }).locator("..")).toContainText("OK");

  await page.goto("/admin/audit");
  await expect(page.getByText("game.repair-game-config")).toBeVisible();
  await expect(page.getByText(gameName)).toBeVisible();
  await expect(page.getByText("success", { exact: true })).toBeVisible();
});
