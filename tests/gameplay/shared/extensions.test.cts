const assert = require("node:assert/strict");
const {
  DEFAULT_PIECE_SKIN_ID,
  DEFAULT_THEME_ID,
  DEFAULT_VICTORY_RULE_SET_ID,
  EXTENSION_SCHEMA_VERSION,
  MAJORITY_CONTROL_VICTORY_RULE_SET_ID,
  findBuiltInNewGameRuleSet,
  listExtensionPacks,
  listBuiltInNewGameRuleSets,
  listPieceSkins,
  listVictoryRuleSets,
  listVisualThemes,
  migrateGameConfigExtensions,
  migrateGameStateExtensions,
  normalizeExtensionSelection,
  validateExtensionPackCatalog
} = require("../../../shared/models.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("extension registries expose default packs and selectable capabilities", () => {
  const packIds = listExtensionPacks().map((pack: { id: string }) => pack.id);
  const pieceSkins = listPieceSkins() as Array<{ id: string; renderStyleId?: string }>;
  assert.equal(packIds.includes("classic"), true);
  assert.equal(packIds.includes("classic-defense-3"), true);
  assert.equal(
    listVictoryRuleSets().some(
      (ruleSet: { id: string }) => ruleSet.id === DEFAULT_VICTORY_RULE_SET_ID
    ),
    true
  );
  assert.equal(
    listVictoryRuleSets().some(
      (ruleSet: { id: string }) => ruleSet.id === MAJORITY_CONTROL_VICTORY_RULE_SET_ID
    ),
    true
  );
  assert.equal(
    listVisualThemes().some((theme: { id: string }) => theme.id === DEFAULT_THEME_ID),
    true
  );
  assert.equal(
    pieceSkins.some((skin: { id: string }) => skin.id === DEFAULT_PIECE_SKIN_ID),
    true
  );
  assert.equal(
    pieceSkins.some((skin: { id: string }) => skin.id === "command-ring"),
    true
  );
  assert.equal(
    pieceSkins.find((skin: { id: string }) => skin.id === DEFAULT_PIECE_SKIN_ID)?.renderStyleId,
    "solid-fill"
  );
  assert.equal(
    pieceSkins.find((skin: { id: string }) => skin.id === "command-ring")?.renderStyleId,
    "ring-core"
  );
});

register("built-in new game rule set summaries stay derived from extension packs", () => {
  const packs = listExtensionPacks() as Array<{
    id: string;
    name: string;
    defaults: {
      mapId: string;
      diceRuleSetId: string;
      victoryRuleSetId: string;
      themeId: string;
      pieceSkinId: string;
    };
  }>;
  const ruleSets = listBuiltInNewGameRuleSets() as Array<Record<string, unknown>>;
  const classicDefensePack = packs.find((pack) => pack.id === "classic-defense-3");
  const classicDefenseRuleSet = findBuiltInNewGameRuleSet("classic-defense-3") as Record<
    string,
    unknown
  > | null;

  if (!classicDefensePack) {
    throw new Error("Expected classic-defense-3 extension pack to exist.");
  }
  assert.equal(ruleSets.length, packs.length);
  assert.deepEqual(
    ruleSets.map((ruleSet) => ruleSet.id),
    packs.map((pack) => pack.id)
  );
  if (!classicDefenseRuleSet) {
    throw new Error("Expected classic-defense-3 built-in new game rule set to exist.");
  }
  assert.deepEqual(Object.keys(classicDefenseRuleSet).sort(), ["defaults", "id", "name"]);
  assert.equal("version" in classicDefenseRuleSet, false);
  assert.equal("mapIds" in classicDefenseRuleSet, false);
  assert.equal("diceRuleSetIds" in classicDefenseRuleSet, false);
  assert.equal("victoryRuleSetIds" in classicDefenseRuleSet, false);
  assert.equal("themeIds" in classicDefenseRuleSet, false);
  assert.equal("pieceSkinIds" in classicDefenseRuleSet, false);
  assert.equal(classicDefenseRuleSet.id, classicDefensePack.id);
  assert.equal(classicDefenseRuleSet.name, classicDefensePack.name);
  assert.equal(
    (classicDefenseRuleSet.defaults as Record<string, unknown>).mapId,
    classicDefensePack.defaults.mapId
  );
  assert.equal(
    (classicDefenseRuleSet.defaults as Record<string, unknown>).diceRuleSetId,
    classicDefensePack.defaults.diceRuleSetId
  );
  assert.equal(
    (classicDefenseRuleSet.defaults as Record<string, unknown>).victoryRuleSetId,
    classicDefensePack.defaults.victoryRuleSetId
  );
  assert.equal(
    (classicDefenseRuleSet.defaults as Record<string, unknown>).themeId,
    classicDefensePack.defaults.themeId
  );
  assert.equal(
    (classicDefenseRuleSet.defaults as Record<string, unknown>).pieceSkinId,
    classicDefensePack.defaults.pieceSkinId
  );
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

register(
  "migrateGameConfigExtensions preserves runtime dice rule ids when metadata is present",
  () => {
    const migrated = migrateGameConfigExtensions({
      ruleSetId: "classic",
      diceRuleSetId: "duel",
      diceRuleSetName: "Duel",
      diceRuleSetAttackerMaxDice: 2,
      diceRuleSetDefenderMaxDice: 1,
      diceRuleSetAttackerMustLeaveOneArmyBehind: true,
      diceRuleSetDefenderWinsTies: true
    });

    assert.equal(migrated.diceRuleSetId, "duel");
    assert.equal(migrated.diceRuleSetName, "Duel");
    assert.equal(migrated.diceRuleSetAttackerMaxDice, 2);
    assert.equal(migrated.diceRuleSetDefenderMaxDice, 1);
  }
);

register(
  "normalizeExtensionSelection falls back to pack defaults for unsupported capability ids",
  () => {
    const normalized = normalizeExtensionSelection({
      ruleSetId: "classic-defense-3",
      mapId: "unknown-map",
      diceRuleSetId: "missing-dice",
      victoryRuleSetId: "missing-victory",
      themeId: "missing-theme",
      pieceSkinId: "missing-piece-skin"
    });

    assert.equal(normalized.mapId, "classic-mini");
    assert.equal(normalized.diceRuleSetId, "defense-3");
    assert.equal(normalized.victoryRuleSetId, DEFAULT_VICTORY_RULE_SET_ID);
    assert.equal(normalized.themeId, DEFAULT_THEME_ID);
    assert.equal(normalized.pieceSkinId, DEFAULT_PIECE_SKIN_ID);
  }
);

register("validateExtensionPackCatalog rejects duplicate pack ids", () => {
  assert.throws(
    () =>
      validateExtensionPackCatalog([
        {
          id: "dup-pack",
          name: "Duplicate A",
          version: 1,
          defaults: {
            mapId: "classic-mini",
            diceRuleSetId: "standard",
            victoryRuleSetId: DEFAULT_VICTORY_RULE_SET_ID,
            themeId: DEFAULT_THEME_ID,
            pieceSkinId: DEFAULT_PIECE_SKIN_ID
          },
          mapIds: ["classic-mini"],
          diceRuleSetIds: ["standard"],
          victoryRuleSetIds: [DEFAULT_VICTORY_RULE_SET_ID],
          themeIds: [DEFAULT_THEME_ID],
          pieceSkinIds: [DEFAULT_PIECE_SKIN_ID]
        },
        {
          id: "dup-pack",
          name: "Duplicate B",
          version: 1,
          defaults: {
            mapId: "classic-mini",
            diceRuleSetId: "standard",
            victoryRuleSetId: DEFAULT_VICTORY_RULE_SET_ID,
            themeId: DEFAULT_THEME_ID,
            pieceSkinId: DEFAULT_PIECE_SKIN_ID
          },
          mapIds: ["classic-mini"],
          diceRuleSetIds: ["standard"],
          victoryRuleSetIds: [DEFAULT_VICTORY_RULE_SET_ID],
          themeIds: [DEFAULT_THEME_ID],
          pieceSkinIds: [DEFAULT_PIECE_SKIN_ID]
        }
      ]),
    /Duplicate extension pack id/i
  );
});

register(
  "validateExtensionPackCatalog rejects packs whose defaults are missing from declared capabilities",
  () => {
    assert.throws(
      () =>
        validateExtensionPackCatalog([
          {
            id: "broken-pack",
            name: "Broken Pack",
            version: 1,
            defaults: {
              mapId: "classic-mini",
              diceRuleSetId: "standard",
              victoryRuleSetId: MAJORITY_CONTROL_VICTORY_RULE_SET_ID,
              themeId: DEFAULT_THEME_ID,
              pieceSkinId: DEFAULT_PIECE_SKIN_ID
            },
            mapIds: ["classic-mini"],
            diceRuleSetIds: ["standard"],
            victoryRuleSetIds: [DEFAULT_VICTORY_RULE_SET_ID],
            themeIds: [DEFAULT_THEME_ID],
            pieceSkinIds: [DEFAULT_PIECE_SKIN_ID]
          }
        ]),
      /must include default victory rule set id/i
    );
  }
);
