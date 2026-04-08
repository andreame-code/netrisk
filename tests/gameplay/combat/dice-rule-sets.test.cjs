const assert = require("node:assert/strict");
const { getDiceRuleSet, listDiceRuleSets } = require("../../../shared/models.cjs");

register("dice registry exposes both two-defense and three-defense standard modes", () => {
  const listedIds = listDiceRuleSets().map((entry) => entry.id);
  assert.ok(listedIds.includes("standard"));
  assert.ok(listedIds.includes("standard-2-defense"));
  assert.ok(listedIds.includes("standard-3-defense"));

  assert.equal(getDiceRuleSet("standard-2-defense").defenderMaxDice, 2);
  assert.equal(getDiceRuleSet("standard-3-defense").defenderMaxDice, 3);
});
