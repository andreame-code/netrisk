const { DEFAULT_VICTORY_RULE_ID } = require("../game-modes.cjs");

const standardEliminationVictoryRule = Object.freeze({
  id: DEFAULT_VICTORY_RULE_ID,
  name: "Eliminazione totale",
  description: "Vince l'ultimo giocatore attivo rimasto sulla mappa.",
  configuration: {
    type: "system"
  }
});

const territoryControlVictoryRule = Object.freeze({
  id: "territory-control",
  name: "Controllo territori",
  description: "Vince chi raggiunge il numero obiettivo di territori configurato nella modalita.",
  configuration: {
    type: "setupOption",
    requiredOptionKeys: ["targetTerritoryCount"]
  }
});

const victoryRules = Object.freeze({
  [standardEliminationVictoryRule.id]: standardEliminationVictoryRule,
  [territoryControlVictoryRule.id]: territoryControlVictoryRule
});

function findVictoryRule(victoryRuleId) {
  if (!victoryRuleId) {
    return null;
  }

  return victoryRules[victoryRuleId] || null;
}

function listVictoryRules() {
  return Object.values(victoryRules).map((rule) => ({
    id: rule.id,
    name: rule.name,
    description: rule.description,
    configuration: rule.configuration
  }));
}

module.exports = {
  standardEliminationVictoryRule,
  territoryControlVictoryRule,
  findVictoryRule,
  listVictoryRules
};
