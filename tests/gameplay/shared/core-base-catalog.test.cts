const assert = require("node:assert/strict");

const {
  findCoreBaseNewGameRuleSet,
  findCoreBaseSupportedMap,
  listCoreBaseMapSummaries,
  listCoreBaseNewGameRuleSets
} = require("../../../shared/core-base-catalog.cjs");
const { listBuiltInNewGameRuleSets } = require("../../../shared/extensions.cjs");
const { listSupportedMaps } = require("../../../shared/maps/index.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("core.base catalog centralizes the canonical supported maps", () => {
  const coreBaseMapIds = listCoreBaseMapSummaries().map((map: { id: string }) => map.id);
  const sharedMapIds = listSupportedMaps().map((map: { id: string }) => map.id);
  const classicMini = findCoreBaseSupportedMap("classic-mini") as {
    id: string;
    name: string;
  } | null;

  assert.deepEqual(coreBaseMapIds, sharedMapIds);
  assert.equal(coreBaseMapIds.includes("classic-mini"), true);
  if (!classicMini) {
    throw new Error("Expected classic-mini to be exposed by the core.base catalog.");
  }
  assert.equal(classicMini.id, "classic-mini");
  assert.equal(classicMini.name, "Classic Mini");
});

register("core.base catalog centralizes the built-in new-game rule sets", () => {
  const coreBaseRuleSetIds = listCoreBaseNewGameRuleSets().map(
    (ruleSet: { id: string }) => ruleSet.id
  );
  const sharedRuleSetIds = listBuiltInNewGameRuleSets().map(
    (ruleSet: { id: string }) => ruleSet.id
  );
  const classicDefense3 = findCoreBaseNewGameRuleSet("classic-defense-3") as {
    id: string;
    name: string;
    defaults: { mapId: string; diceRuleSetId: string };
  } | null;

  assert.deepEqual(coreBaseRuleSetIds, sharedRuleSetIds);
  assert.deepEqual(coreBaseRuleSetIds, ["classic", "classic-defense-3"]);
  if (!classicDefense3) {
    throw new Error("Expected classic-defense-3 to be exposed by the core.base catalog.");
  }
  assert.equal(classicDefense3.id, "classic-defense-3");
  assert.equal(classicDefense3.name, "Classic Defense 3");
  assert.equal(classicDefense3.defaults.mapId, "classic-mini");
  assert.equal(classicDefense3.defaults.diceRuleSetId, "defense-3");
});

register("core.base catalog returns null for unknown map and rule set ids", () => {
  assert.equal(findCoreBaseSupportedMap("missing-map"), null);
  assert.equal(findCoreBaseNewGameRuleSet("missing-rule-set"), null);
});
