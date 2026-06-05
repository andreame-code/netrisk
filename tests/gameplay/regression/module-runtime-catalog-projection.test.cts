const assert = require("node:assert/strict");

import type * as RuntimeCatalogProjectionModule from "../../../backend/module-runtime-catalog-projection.cjs";
const { projectRuntimeCatalogInputs } =
  require("../../../backend/module-runtime-catalog-projection.cjs") as typeof RuntimeCatalogProjectionModule;

declare function register(name: string, fn: () => void | Promise<void>): void;

type ContributionEntry = {
  id: string;
  moduleId: string;
};

function installedModule(
  id: string,
  options: { enabled?: boolean; compatible?: boolean } = {}
): any {
  return {
    id,
    version: "1.0.0",
    displayName: id,
    description: null,
    kind: "hybrid",
    sourcePath: `/modules/${id}`,
    status: "loaded",
    enabled: options.enabled ?? true,
    compatible: options.compatible ?? true,
    manifest: null,
    capabilities: [],
    warnings: [],
    errors: []
  };
}

function contribution(moduleId: string, id: string): ContributionEntry {
  return { id, moduleId };
}

register("module runtime catalog projection include solo moduli abilitati e compatibili", () => {
  const projection = projectRuntimeCatalogInputs(
    [
      installedModule("enabled"),
      installedModule("disabled", { enabled: false }),
      installedModule("incompatible", { compatible: false })
    ],
    [],
    [],
    [],
    [],
    [],
    []
  );

  assert.deepEqual(
    projection.enabledModules.map((moduleEntry) => moduleEntry.id),
    ["enabled"]
  );
});

register("module runtime catalog projection filtra i contributi per modulo abilitato", () => {
  const mapEntries = [
    contribution("enabled", "map-enabled"),
    contribution("disabled", "map-disabled"),
    contribution("incompatible", "map-incompatible"),
    contribution("missing", "map-missing")
  ];
  const contentPackEntries = [
    contribution("enabled", "pack-enabled"),
    contribution("disabled", "pack-disabled")
  ];
  const playerPieceSetEntries = [
    contribution("enabled", "pieces-enabled"),
    contribution("incompatible", "pieces-incompatible")
  ];
  const diceRuleSetEntries = [
    contribution("enabled", "dice-enabled"),
    contribution("missing", "dice-missing")
  ];
  const cardRuleSetEntries = [
    contribution("enabled", "cards-enabled"),
    contribution("missing", "cards-missing")
  ];
  const siteThemeEntries = [
    contribution("enabled", "theme-enabled"),
    contribution("disabled", "theme-disabled")
  ];

  const projection = projectRuntimeCatalogInputs(
    [
      installedModule("enabled"),
      installedModule("disabled", { enabled: false }),
      installedModule("incompatible", { compatible: false })
    ],
    mapEntries,
    contentPackEntries,
    playerPieceSetEntries,
    diceRuleSetEntries,
    cardRuleSetEntries,
    siteThemeEntries
  );

  assert.deepEqual(projection.enabledRuntimeMapEntries, [mapEntries[0]]);
  assert.deepEqual(projection.enabledRuntimeContentPackEntries, [contentPackEntries[0]]);
  assert.deepEqual(projection.enabledRuntimePlayerPieceSetEntries, [playerPieceSetEntries[0]]);
  assert.deepEqual(projection.enabledRuntimeDiceRuleSetEntries, [diceRuleSetEntries[0]]);
  assert.deepEqual(projection.enabledRuntimeCardRuleSetEntries, [cardRuleSetEntries[0]]);
  assert.deepEqual(projection.enabledRuntimeSiteThemeEntries, [siteThemeEntries[0]]);
});
