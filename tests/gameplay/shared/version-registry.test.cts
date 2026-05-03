const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createGameSessionStore } = require("../../../backend/game-session-store.cjs");
const { createGameState } = require("../../../shared/models.cjs");
const {
  buildVersionSnapshot,
  isModuleApiCompatible,
  isSaveGameSchemaCompatible,
  isSaveGameSchemaRangeCompatible
} = require("../../../shared/compatibility.cjs");
const {
  apiVersion,
  appVersion,
  datastoreSchemaVersion,
  engineVersion,
  minimumCompatibleModuleApiVersion,
  minimumCompatibleSaveGameSchemaVersion,
  moduleApiVersion,
  saveGameSchemaVersion,
  unversionedSaveGameSchemaVersion,
  versionManifest
} = require("../../../shared/version-manifest.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function cleanupSqliteFiles(dbFile: string) {
  [dbFile, dbFile + "-shm", dbFile + "-wal"].forEach((target) => {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  });
}

register("version manifest exports the central compatibility fields", () => {
  assert.deepEqual(versionManifest, {
    appVersion,
    engineVersion,
    apiVersion,
    datastoreSchemaVersion,
    saveGameSchemaVersion,
    moduleApiVersion,
    minimumCompatibleSaveGameSchemaVersion,
    minimumCompatibleModuleApiVersion
  });
});

register("version snapshot exposes the current compatibility surface", () => {
  assert.deepEqual(buildVersionSnapshot(), {
    appVersion,
    engineVersion,
    apiVersion,
    datastoreSchemaVersion,
    saveGameSchemaVersion,
    moduleApiVersion,
    minimumCompatibleSaveGameSchemaVersion,
    minimumCompatibleModuleApiVersion,
    compatible: true
  });
});

register("save-game and module compatibility checks use the registry baseline", () => {
  assert.equal(isSaveGameSchemaCompatible(saveGameSchemaVersion), true);
  assert.equal(unversionedSaveGameSchemaVersion, 1);
  assert.equal(isSaveGameSchemaCompatible(undefined), true);
  assert.equal(isSaveGameSchemaCompatible(0), false);
  assert.equal(isSaveGameSchemaCompatible(saveGameSchemaVersion + 1), false);
  assert.equal(isSaveGameSchemaCompatible("invalid"), false);
  assert.equal(isSaveGameSchemaRangeCompatible(1, 1), true);
  assert.equal(isSaveGameSchemaRangeCompatible(2, 2), false);
  assert.equal(isSaveGameSchemaRangeCompatible(0, 0), false);

  assert.equal(isModuleApiCompatible(moduleApiVersion), true);
  assert.equal(isModuleApiCompatible("0.0.0"), false);
  assert.equal(isModuleApiCompatible("1.0.1"), false);
  assert.equal(isModuleApiCompatible("invalid"), false);
});

register("new game states include version metadata from the registry", () => {
  const state = createGameState();

  assert.deepEqual(state.versionMetadata, {
    schemaVersion: saveGameSchemaVersion,
    engineVersion,
    createdWithAppVersion: appVersion
  });
  assert.equal(isSaveGameSchemaCompatible(state.versionMetadata.schemaVersion), true);
});

register("legacy saved game states without version metadata remain compatible", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-version-registry-"));
  const dataFile = path.join(tempDir, "games.json");
  const dbFile = path.join(tempDir, "netrisk.sqlite");
  const legacyState = createGameState({
    log: ["Legacy saved game"]
  });
  delete (legacyState as Record<string, unknown>).versionMetadata;

  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        games: [
          {
            id: "legacy-version-game",
            name: "Legacy Version Game",
            version: 4,
            creatorUserId: null,
            state: legacyState,
            createdAt: "2026-04-01T10:00:00.000Z",
            updatedAt: "2026-04-01T10:05:00.000Z"
          }
        ],
        activeGameId: "legacy-version-game"
      },
      null,
      2
    ),
    "utf8"
  );

  const store = createGameSessionStore({
    dataFile,
    dbFile
  });

  try {
    const opened = store.openGame("legacy-version-game");

    assert.equal(opened.game.version, 4);
    assert.equal(opened.state.log.includes("Legacy saved game"), true);
    assert.equal(typeof opened.state.versionMetadata, "undefined");
    assert.equal(isSaveGameSchemaCompatible(opened.state.versionMetadata?.schemaVersion), true);
  } finally {
    store.datastore.close();
    cleanupSqliteFiles(dbFile);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
