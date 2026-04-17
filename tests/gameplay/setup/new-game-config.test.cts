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
