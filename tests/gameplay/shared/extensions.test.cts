const assert = require("node:assert/strict");
const {
  DEFAULT_PIECE_SKIN_ID,
  DEFAULT_THEME_ID,
  DEFAULT_VICTORY_RULE_SET_ID,
  EXTENSION_SCHEMA_VERSION,
  listExtensionPacks,
  listPieceSkins,
  listVictoryRuleSets,
  listVisualThemes,
  migrateGameConfigExtensions,
  migrateGameStateExtensions
} = require("../../../shared/models.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("extension registries expose default packs and selectable capabilities", () => {
  const packIds = listExtensionPacks().map((pack: { id: string }) => pack.id);
  assert.equal(packIds.includes("classic"), true);
  assert.equal(packIds.includes("classic-defense-3"), true);
  assert.equal(listVictoryRuleSets().some((ruleSet: { id: string }) => ruleSet.id === DEFAULT_VICTORY_RULE_SET_ID), true);
  assert.equal(listVisualThemes().some((theme: { id: string }) => theme.id === DEFAULT_THEME_ID), true);
  assert.equal(listPieceSkins().some((skin: { id: string }) => skin.id === DEFAULT_PIECE_SKIN_ID), true);
  assert.equal(listPieceSkins().some((skin: { id: string }) => skin.id === "command-ring"), true);
});

register("migrateGameConfigExtensions preserves legacy selections and fills new defaults", () => {
  const migrated = migrateGameConfigExtensions({
    ruleSetId: "classic-defense-3",
    mapId: "middle-earth",
    diceRuleSetId: "defense-3"
  });

  assert.equal(migrated.extensionSchemaVersion, EXTENSION_SCHEMA_VERSION);
  assert.equal(migrated.ruleSetId, "classic-defense-3");
  assert.equal(migrated.mapId, "middle-earth");
  assert.equal(migrated.diceRuleSetId, "defense-3");
  assert.equal(migrated.victoryRuleSetId, DEFAULT_VICTORY_RULE_SET_ID);
  assert.equal(migrated.themeId, DEFAULT_THEME_ID);
  assert.equal(migrated.pieceSkinId, DEFAULT_PIECE_SKIN_ID);
});

register("migrateGameStateExtensions backfills gameConfig for legacy states", () => {
  const state = {
    phase: "lobby",
    mapId: "world-classic",
    mapName: "World Classic",
    diceRuleSetId: "standard",
    players: []
  };

  const migrated = migrateGameStateExtensions(state);
  assert.equal(migrated.gameConfig.mapId, "world-classic");
  assert.equal(migrated.gameConfig.mapName, "World Classic");
  assert.equal(migrated.gameConfig.diceRuleSetId, "standard");
  assert.equal(migrated.gameConfig.victoryRuleSetId, DEFAULT_VICTORY_RULE_SET_ID);
  assert.equal(migrated.gameConfig.themeId, DEFAULT_THEME_ID);
  assert.equal(migrated.gameConfig.pieceSkinId, DEFAULT_PIECE_SKIN_ID);
});
