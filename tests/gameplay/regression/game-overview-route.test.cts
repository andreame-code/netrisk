const assert = require("node:assert/strict");
const { handleGameOptionsRoute } = require("../../../backend/routes/game-overview.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("handleGameOptionsRoute derives legacy options from the resolved catalog", async () => {
  const payloads: Array<Record<string, unknown>> = [];

  await handleGameOptionsRoute(
    {},
    () => ({
      modules: [{ id: "installed.module" }],
      enabledModules: [{ id: "demo.valid", version: "1.0.0" }],
      gameModules: [{ id: "demo.valid" }],
      ruleSets: [{ id: "classic" }],
      maps: [{ id: "classic-mini" }],
      diceRuleSets: [{ id: "standard" }],
      victoryRuleSets: [{ id: "conquest" }],
      themes: [{ id: "command" }],
      pieceSkins: [{ id: "classic-color" }],
      playerPieceSets: [{ id: "classic-pieces" }],
      contentPacks: [{ id: "base-pack" }],
      gamePresets: [{ id: "demo.preset" }],
      contentProfiles: [{ id: "demo.content" }],
      gameplayProfiles: [{ id: "demo.gameplay" }],
      uiProfiles: [{ id: "demo.ui" }],
      uiSlots: [{ slotId: "topnav.before", itemId: "demo.slot", title: "Demo", kind: "panel" }]
    }),
    () => [12, 24],
    (_res: unknown, _statusCode: number, payload: Record<string, unknown>) => {
      payloads.push(payload);
    }
  );

  assert.equal(payloads.length, 1);
  assert.deepEqual(payloads[0].modules, [{ id: "demo.valid" }]);
  assert.deepEqual(payloads[0].enabledModules, [{ id: "demo.valid", version: "1.0.0" }]);
  assert.deepEqual(payloads[0].victoryRuleSets, [{ id: "conquest" }]);
  assert.deepEqual(payloads[0].themes, [{ id: "command" }]);
  assert.deepEqual(payloads[0].pieceSkins, [{ id: "classic-color" }]);
  assert.deepEqual(payloads[0].resolvedCatalog, {
    modules: [{ id: "installed.module" }],
    enabledModules: [{ id: "demo.valid", version: "1.0.0" }],
    gameModules: [{ id: "demo.valid" }],
    ruleSets: [{ id: "classic" }],
    maps: [{ id: "classic-mini" }],
    diceRuleSets: [{ id: "standard" }],
    victoryRuleSets: [{ id: "conquest" }],
    themes: [{ id: "command" }],
    pieceSkins: [{ id: "classic-color" }],
    playerPieceSets: [{ id: "classic-pieces" }],
    contentPacks: [{ id: "base-pack" }],
    gamePresets: [{ id: "demo.preset" }],
    contentProfiles: [{ id: "demo.content" }],
    gameplayProfiles: [{ id: "demo.gameplay" }],
    uiProfiles: [{ id: "demo.ui" }],
    uiSlots: [{ slotId: "topnav.before", itemId: "demo.slot", title: "Demo", kind: "panel" }]
  });
});
