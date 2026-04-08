const { getStateVictoryRule } = require("./runtime-config.cjs");
const { evaluateVictoryRule } = require("./victory-rule-registry.cjs");

function detectVictory(state) {
  return evaluateVictoryRule(state, getStateVictoryRule(state));
}

module.exports = {
  detectVictory
};
