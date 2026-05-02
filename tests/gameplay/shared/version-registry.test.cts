const assert = require("node:assert/strict");
const {
  buildVersionSnapshot,
  isModuleApiCompatible,
  isSaveGameSchemaCompatible
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

  assert.equal(isModuleApiCompatible(moduleApiVersion), true);
  assert.equal(isModuleApiCompatible("0.0.0"), false);
  assert.equal(isModuleApiCompatible("1.0.1"), false);
  assert.equal(isModuleApiCompatible("invalid"), false);
});
