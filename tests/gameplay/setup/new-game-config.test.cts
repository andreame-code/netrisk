const assert = require("node:assert/strict");
const {
  createConfiguredInitialState,
  validateNewGameConfig
} = require("../../../backend/new-game-config.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

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
  assert.equal(config.themeId, "command");
  assert.equal(config.pieceSkinId, "classic-color");
  assert.equal(config.extensionSchemaVersion, 1);
});

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
