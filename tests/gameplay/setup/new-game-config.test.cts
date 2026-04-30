const assert = require("node:assert/strict");
const {
  createConfiguredInitialState,
  findSupportedMap,
  findNewGameRuleSet,
  listNewGameRuleSets,
  listSupportedMaps,
  validateNewGameConfig
} = require("../../../backend/new-game-config.cjs");
const {
  findCoreBaseNewGameRuleSet,
  findCoreBaseSupportedMap,
  listCoreBaseMapSummaries,
  listCoreBaseNewGameRuleSets
} = require("../../../shared/core-base-catalog.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function testTheme(themeId: string) {
  return {
    id: themeId,
    name: `Test ${themeId}`,
    description: "Theme resolved by a test catalog"
  };
}

register("new game rule set lookups expose only the minimal built-in adapter shape", () => {
  const listedRuleSet = listNewGameRuleSets().find(
    (ruleSet: { id: string }) => ruleSet.id === "classic-defense-3"
  ) as Record<string, unknown> | undefined;
  const foundRuleSet = findNewGameRuleSet("classic-defense-3") as Record<string, unknown> | null;

  if (!listedRuleSet) {
    throw new Error("Expected classic-defense-3 to be listed among built-in new game rule sets.");
  }
  if (!foundRuleSet) {
    throw new Error("Expected classic-defense-3 built-in new game rule set to exist.");
  }
  assert.deepEqual(Object.keys(foundRuleSet).sort(), ["defaults", "id", "name"]);
  assert.equal("version" in foundRuleSet, false);
  assert.equal("mapIds" in foundRuleSet, false);
  assert.equal("diceRuleSetIds" in foundRuleSet, false);
  assert.equal(listedRuleSet.id, foundRuleSet.id);
  assert.equal(listedRuleSet.name, foundRuleSet.name);
});

register(
  "new game config delegates maps and built-in rule sets to the shared core.base catalog",
  () => {
    assert.deepEqual(
      listNewGameRuleSets().map((ruleSet: { id: string }) => ruleSet.id),
      listCoreBaseNewGameRuleSets().map((ruleSet: { id: string }) => ruleSet.id)
    );
    assert.deepEqual(
      listSupportedMaps().map((map: { id: string }) => map.id),
      listCoreBaseMapSummaries().map((map: { id: string }) => map.id)
    );

    assert.deepEqual(
      findNewGameRuleSet("classic-defense-3"),
      findCoreBaseNewGameRuleSet("classic-defense-3")
    );
    assert.deepEqual(findSupportedMap("classic-mini"), findCoreBaseSupportedMap("classic-mini"));
  }
);

register("validateNewGameConfig supports injected rule set resolvers", () => {
  const config = validateNewGameConfig(
    {
      ruleSetId: "runtime.classic",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    },
    {
      random: () => 0,
      resolveRuleSet: (ruleSetId: string) =>
        ruleSetId === "runtime.classic"
          ? {
              id: "runtime.classic",
              name: "Runtime Classic",
              defaults: {
                extensionSchemaVersion: 1,
                mapId: "classic-mini",
                diceRuleSetId: "standard",
                victoryRuleSetId: "conquest",
                themeId: "command",
                pieceSkinId: "classic-color"
              }
            }
          : null
    }
  );

  assert.equal(config.ruleSetId, "runtime.classic");
  assert.equal(config.ruleSetName, "Runtime Classic");
  assert.equal(config.mapId, "classic-mini");
  assert.equal(config.diceRuleSetId, "standard");
  assert.equal(config.victoryRuleSetId, "conquest");
});

register("validateNewGameConfig derives modular defaults from the selected extension pack", () => {
  const config = validateNewGameConfig(
    {
      ruleSetId: "classic-defense-3",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    },
    { random: () => 0 }
  );

  assert.equal(config.ruleSetId, "classic-defense-3");
  assert.equal(config.diceRuleSetId, "defense-3");
  assert.equal(config.victoryRuleSetId, "conquest");
  assert.equal(config.themeId, "war-table");
  assert.equal(config.pieceSkinId, "classic-color");
  assert.equal(config.extensionSchemaVersion, 1);
});

register(
  "validateNewGameConfig keeps deriving defaults from ruleSetId with the minimal built-in adapter",
  () => {
    const selectedRuleSet = findNewGameRuleSet("classic-defense-3") as Record<
      string,
      unknown
    > | null;

    if (!selectedRuleSet) {
      throw new Error("Expected classic-defense-3 built-in new game rule set to exist.");
    }
    assert.deepEqual(Object.keys(selectedRuleSet).sort(), ["defaults", "id", "name"]);

    const config = validateNewGameConfig(
      {
        ruleSetId: "classic-defense-3",
        totalPlayers: 2,
        players: [{ type: "human" }, { type: "ai" }]
      },
      { random: () => 0 }
    );

    assert.equal(config.ruleSetId, "classic-defense-3");
    assert.equal(config.ruleSetName, "Classic Defense 3");
    assert.equal(config.mapId, "classic-mini");
    assert.equal(config.diceRuleSetId, "defense-3");
    assert.equal(config.victoryRuleSetId, "conquest");
    assert.equal(config.themeId, "war-table");
    assert.equal(config.pieceSkinId, "classic-color");
  }
);

register("validateNewGameConfig supports injected victory, theme, and piece skin resolvers", () => {
  const config = validateNewGameConfig(
    {
      victoryRuleSetId: "runtime-victory",
      themeId: "runtime-theme",
      pieceSkinId: "runtime-skin",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    },
    {
      random: () => 0,
      resolveVictoryRuleSet: (victoryRuleSetId: string) =>
        victoryRuleSetId === "runtime-victory"
          ? {
              id: "runtime-victory",
              name: "Runtime Victory",
              description: "Victory rule resolved from runtime catalog"
            }
          : null,
      resolveTheme: (themeId: string) =>
        themeId === "runtime-theme"
          ? {
              id: "runtime-theme",
              name: "Runtime Theme",
              description: "Theme resolved from runtime catalog"
            }
          : null,
      resolvePieceSkin: (pieceSkinId: string) =>
        pieceSkinId === "runtime-skin"
          ? {
              id: "runtime-skin",
              name: "Runtime Skin",
              description: "Piece skin resolved from runtime catalog",
              renderStyleId: "runtime-style",
              usesPlayerColor: true
            }
          : null
    }
  );

  assert.equal(config.victoryRuleSetId, "runtime-victory");
  assert.equal(config.themeId, "runtime-theme");
  assert.equal(config.pieceSkinId, "runtime-skin");
});

register(
  "validateNewGameConfig falls back to the default resolved theme for implicit selections",
  () => {
    const config = validateNewGameConfig(
      {
        totalPlayers: 2,
        players: [{ type: "human" }, { type: "ai" }]
      },
      {
        random: () => 0,
        resolveTheme: (themeId: string) => (themeId === "command" ? testTheme("command") : null),
        resolveDefaultTheme: () => testTheme("command")
      }
    );

    assert.equal(config.themeId, "command");
  }
);

register(
  "validateNewGameConfig rejects explicit unsupported themes before default fallback",
  () => {
    assert.throws(
      () =>
        validateNewGameConfig(
          {
            themeId: "war-table",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "ai" }]
          },
          {
            random: () => 0,
            resolveTheme: (themeId: string) =>
              themeId === "command" ? testTheme("command") : null,
            resolveDefaultTheme: () => testTheme("command")
          }
        ),
      (error: { messageKey?: string }) => error.messageKey === "newGame.invalidTheme"
    );
  }
);

register(
  "createConfiguredInitialState forwards runtime preset victory, theme and piece skin defaults",
  () => {
    let resolvedSelectionInput: any = null;

    const configured = createConfiguredInitialState(
      {
        gamePresetId: "demo.catalog.command-preset",
        totalPlayers: 2,
        players: [{ type: "human" }, { type: "ai" }]
      },
      {
        random: () => 0,
        resolveGamePreset: () => ({
          id: "demo.catalog.command-preset",
          name: "Demo Catalog Command Preset",
          activeModuleIds: ["demo.catalog"],
          defaults: {
            victoryRuleSetId: "majority-control",
            themeId: "ember",
            pieceSkinId: "command-ring"
          }
        }),
        resolveGameModuleSelection: (input: any) => {
          resolvedSelectionInput = input;
          return {
            moduleSchemaVersion: 1,
            activeModules: [
              { id: "core.base", version: "1.0.0" },
              { id: "demo.catalog", version: "1.0.0" }
            ],
            contentProfileId: null,
            gameplayProfileId: null,
            uiProfileId: null
          };
        }
      }
    );

    assert.equal(resolvedSelectionInput.victoryRuleSetId, "majority-control");
    assert.equal(resolvedSelectionInput.themeId, "ember");
    assert.equal(resolvedSelectionInput.pieceSkinId, "command-ring");
    assert.equal(configured.state.gameConfig.victoryRuleSetId, "majority-control");
    assert.equal(configured.state.gameConfig.themeId, "ember");
    assert.equal(configured.state.gameConfig.pieceSkinId, "command-ring");
  }
);

register("createConfiguredInitialState preserves runtime-resolved setup ids in gameConfig", () => {
  const configured = createConfiguredInitialState(
    {
      ruleSetId: "runtime.classic",
      victoryRuleSetId: "runtime-victory",
      themeId: "runtime-theme",
      pieceSkinId: "runtime-skin",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    },
    {
      random: () => 0,
      resolveRuleSet: (ruleSetId: string) =>
        ruleSetId === "runtime.classic"
          ? {
              id: "runtime.classic",
              name: "Runtime Classic",
              defaults: {
                extensionSchemaVersion: 1,
                mapId: "classic-mini",
                diceRuleSetId: "standard",
                victoryRuleSetId: "runtime-victory",
                themeId: "runtime-theme",
                pieceSkinId: "runtime-skin"
              }
            }
          : null,
      resolveVictoryRuleSet: (victoryRuleSetId: string) =>
        victoryRuleSetId === "runtime-victory"
          ? {
              id: "runtime-victory",
              name: "Runtime Victory",
              description: "Victory rule resolved from runtime catalog"
            }
          : null,
      resolveTheme: (themeId: string) =>
        themeId === "runtime-theme"
          ? {
              id: "runtime-theme",
              name: "Runtime Theme",
              description: "Theme resolved from runtime catalog"
            }
          : null,
      resolvePieceSkin: (pieceSkinId: string) =>
        pieceSkinId === "runtime-skin"
          ? {
              id: "runtime-skin",
              name: "Runtime Skin",
              description: "Piece skin resolved from runtime catalog",
              renderStyleId: "runtime-style",
              usesPlayerColor: true
            }
          : null
    }
  );

  assert.equal(configured.state.gameConfig.ruleSetId, "runtime.classic");
  assert.equal(configured.state.gameConfig.ruleSetName, "Runtime Classic");
  assert.equal(configured.state.gameConfig.victoryRuleSetId, "runtime-victory");
  assert.equal(configured.state.gameConfig.themeId, "runtime-theme");
  assert.equal(configured.state.gameConfig.pieceSkinId, "runtime-skin");
});

register(
  "createConfiguredInitialState writes explicit extension selections into gameConfig",
  () => {
    const configured = createConfiguredInitialState(
      {
        ruleSetId: "classic",
        mapId: "middle-earth",
        diceRuleSetId: "standard",
        victoryRuleSetId: "conquest",
        themeId: "ember",
        pieceSkinId: "command-ring",
        totalPlayers: 2,
        players: [{ type: "human" }, { type: "ai" }]
      },
      { random: () => 0 }
    );

    assert.equal(configured.state.gameConfig.extensionSchemaVersion, 1);
    assert.equal(configured.state.gameConfig.mapId, "middle-earth");
    assert.equal(configured.state.gameConfig.diceRuleSetId, "standard");
    assert.equal(configured.state.gameConfig.victoryRuleSetId, "conquest");
    assert.equal(configured.state.gameConfig.themeId, "ember");
    assert.equal(configured.state.gameConfig.pieceSkinId, "command-ring");
  }
);

register("validateNewGameConfig rejects unsupported victory rules", () => {
  assert.throws(
    () =>
      validateNewGameConfig({
        victoryRuleSetId: "unknown-rule"
      }),
    /regola vittoria/i
  );
});

register("validateNewGameConfig rejects unsupported maps", () => {
  assert.throws(
    () =>
      validateNewGameConfig({
        mapId: "unknown-map"
      }),
    /mappa selezionata/i
  );
});
