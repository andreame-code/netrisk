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

function insertGameFixtures(prefix) {
  const staleUpdatedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const recentUpdatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const fixtures = [
    {
      id: `${prefix}-stale`,
      name: `${prefix} stale lobby`,
      phase: "lobby",
      updatedAt: staleUpdatedAt
    },
    {
      id: `${prefix}-recent`,
      name: `${prefix} recent lobby`,
      phase: "lobby",
      updatedAt: recentUpdatedAt
    },
    {
      id: `${prefix}-active`,
      name: `${prefix} active game`,
      phase: "active",
      updatedAt: staleUpdatedAt
    },
    {
      id: `${prefix}-finished`,
      name: `${prefix} finished game`,
      phase: "finished",
      updatedAt: staleUpdatedAt
    }
  ];

  withE2eDatabase((db) => {
    const insert = db.prepare(
      "INSERT INTO games (id, name, version, creator_user_id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const fixture of fixtures) {
      const state = {
        phase: fixture.phase,
        players: [],
        territories: {},
        hands: {},
        gameConfig: {}
      };
      const result = insert.run(
        fixture.id,
        fixture.name,
        4,
        null,
        JSON.stringify(state),
        staleUpdatedAt,
        fixture.updatedAt
      );
      expect(result.changes).toBe(1);
    }
  });

  return fixtures;
}

test("admin removes only an eligible stale lobby and refreshes health and audit", async ({
  page
}) => {
  await resetGame(page);

  const adminUsername = uniqueUser("admin_stale_uat");
  const sessionToken = await createAuthenticatedSession(page, adminUsername);
  promoteUserToAdmin(adminUsername);
  const prefix = uniqueUser("stale_cleanup_uat");
  const fixtures = insertGameFixtures(prefix);
  const staleFixture = fixtures[0];
  await attachSessionCookie(page, sessionToken);

  await page.goto("/admin/maintenance");
  await expect(page.getByTestId("admin-route-page")).toBeVisible();
  await expect(page.getByText("Stale after 7 days")).toBeVisible();
  const candidateName = page.getByText(staleFixture.name, { exact: true });
  await expect(candidateName).toBeVisible();
  await expect(candidateName.locator("..")).toContainText(staleFixture.id);
  await expect(page.getByText(fixtures[1].name, { exact: true })).toHaveCount(0);
  await expect(page.getByText(fixtures[2].name, { exact: true })).toHaveCount(0);
  await expect(page.getByText(fixtures[3].name, { exact: true })).toHaveCount(0);

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    expect(dialog.message()).toBe("Type cleanup-stale-lobbies to confirm cleanup.");
    await dialog.accept("cleanup-stale-lobbies");
  });
  await page.getByRole("button", { name: "Cleanup stale lobbies" }).click();

  await expect(page.getByText(/removed 1 · skipped 0 · failed 0/)).toBeVisible();
  await expect(candidateName).toHaveCount(0);
  await expect(page.getByText("No stale lobbies are currently eligible.")).toBeVisible();

  withE2eDatabase((db) => {
    expect(db.prepare("SELECT id FROM games WHERE id = ?").get(staleFixture.id)).toBeUndefined();
    for (const fixture of fixtures.slice(1)) {
      expect(db.prepare("SELECT id FROM games WHERE id = ?").get(fixture.id)).toBeTruthy();
    }
  });

  await page.goto("/admin/system-health");
  await expect(page.getByText("Stale lobbies", { exact: true }).locator("..")).toContainText("OK");

  await page.goto("/admin/audit");
  await expect(page.getByText("maintenance.cleanup-stale-lobbies")).toBeVisible();
  await expect(page.getByText("success", { exact: true })).toBeVisible();
});
