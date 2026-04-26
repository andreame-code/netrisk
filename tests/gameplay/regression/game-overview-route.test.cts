const assert = require("node:assert/strict");
const {
  handleGameOptionsRoute,
  handleGamesListRoute
} = require("../../../backend/routes/game-overview.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type ValidationIssue = {
  path: string;
};

type LocalizedErrorCall = [
  unknown,
  number,
  unknown,
  string,
  string,
  Record<string, unknown> | undefined,
  string,
  { validationErrors: ValidationIssue[] }
];

function requireLocalizedErrorCall(call: LocalizedErrorCall | null): LocalizedErrorCall {
  if (!call) {
    throw new Error("Expected a localized validation error call.");
  }
  return call;
}

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

register("handleGamesListRoute validates outbound list payloads", async () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;

  await handleGamesListRoute(
    {},
    () => [
      {
        id: "game-1",
        phase: "lobby",
        playerCount: 2,
        updatedAt: "2026-04-26T00:00:00.000Z"
      }
    ],
    () => 42 as unknown as string,
    () => {
      throw new Error("sendJson should not run when list payload validation fails.");
    },
    new URL("http://127.0.0.1/api/games"),
    (...args: LocalizedErrorCall) => {
      localizedErrorCall = args;
    }
  );

  assert.ok(localizedErrorCall);
  const call = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(call[1], 500);
  assert.equal(call[6], "RESPONSE_VALIDATION_FAILED");
  assert.equal(
    call[7].validationErrors.some(
      (entry: ValidationIssue) => entry.path === "games.0.name" || entry.path === "activeGameId"
    ),
    true
  );
});

register("handleGameOptionsRoute normalizes empty catalog sections and merges extra options", async () => {
  const payloads: Array<Record<string, unknown>> = [];

  await handleGameOptionsRoute(
    {},
    () => null,
    () => [24, 48, 72],
    (_res: unknown, _statusCode: number, payload: Record<string, unknown>) => {
      payloads.push(payload);
    },
    async () => ({
      customFeatureFlags: ["demo"],
      activeGameId: "game-2"
    })
  );

  assert.equal(payloads.length, 1);
  assert.deepEqual(payloads[0].modules, []);
  assert.deepEqual(payloads[0].maps, []);
  assert.deepEqual(payloads[0].themes, []);
  assert.deepEqual(payloads[0].turnTimeoutHoursOptions, [24, 48, 72]);
  assert.deepEqual(payloads[0].playerRange, { min: 2, max: 4 });
  assert.deepEqual(payloads[0].customFeatureFlags, ["demo"]);
  assert.equal(payloads[0].activeGameId, "game-2");
});

register("handleGameOptionsRoute validates outbound payloads when response validation is enabled", async () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;

  await handleGameOptionsRoute(
    {},
    () => ({
      modules: [],
      gameModules: [],
      enabledModules: [],
      maps: [],
      ruleSets: [],
      playerPieceSets: [],
      diceRuleSets: [],
      contentPacks: [],
      victoryRuleSets: [],
      themes: [],
      pieceSkins: [],
      gamePresets: [],
      uiSlots: [],
      contentProfiles: [],
      gameplayProfiles: [],
      uiProfiles: [],
      content: {}
    }),
    () => [12, 24],
    () => {
      throw new Error("sendJson should not run when options payload validation fails.");
    },
    () => ({
      playerRange: {
        min: "two",
        max: 4
      }
    }),
    (...args: LocalizedErrorCall) => {
      localizedErrorCall = args;
    }
  );

  assert.ok(localizedErrorCall);
  const call = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(call[1], 500);
  assert.equal(call[6], "RESPONSE_VALIDATION_FAILED");
  assert.equal(
    call[7].validationErrors.some((entry: ValidationIssue) => entry.path === "playerRange.min"),
    true
  );
});
