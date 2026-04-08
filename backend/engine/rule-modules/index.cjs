function integerOption(value, fallbackValue = 0) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized)) {
    return fallbackValue;
  }

  return normalized;
}

const reinforcementBonusRuleModule = Object.freeze({
  id: "reinforcement-bonus",
  name: "Bonus rinforzi",
  description: "Aggiunge rinforzi extra per turno tramite setupOptions.extraReinforcementsPerTurn.",
  hooks: {
    onCalculateReinforcements(context) {
      const extraReinforcements = integerOption(context?.gameModeDefinition?.setupOptions?.extraReinforcementsPerTurn, 0);
      if (extraReinforcements <= 0) {
        return;
      }

      context.breakdown.moduleBonuses.push({
        ruleModuleId: "reinforcement-bonus",
        label: "Bonus modalita",
        value: extraReinforcements
      });
      context.breakdown.totalReinforcements += extraReinforcements;
    }
  }
});

const ruleModules = Object.freeze({
  [reinforcementBonusRuleModule.id]: reinforcementBonusRuleModule
});

function findRuleModule(ruleModuleId) {
  if (!ruleModuleId) {
    return null;
  }

  return ruleModules[ruleModuleId] || null;
}

function listRuleModules() {
  return Object.values(ruleModules).map((moduleDefinition) => ({
    id: moduleDefinition.id,
    name: moduleDefinition.name,
    description: moduleDefinition.description
  }));
}

function resolveEnabledRuleModules(gameModeDefinition) {
  const enabledIds = Array.isArray(gameModeDefinition?.enabledRuleModuleIds)
    ? gameModeDefinition.enabledRuleModuleIds
    : [];

  return enabledIds
    .map((ruleModuleId) => findRuleModule(ruleModuleId))
    .filter(Boolean);
}

function applyRuleHook(state, hookName, context = {}) {
  const modules = resolveEnabledRuleModules(state?.gameModeDefinition);
  const results = [];

  modules.forEach((moduleDefinition) => {
    const hook = moduleDefinition?.hooks?.[hookName];
    if (typeof hook !== "function") {
      return;
    }

    results.push(hook({
      ...context,
      state,
      gameModeDefinition: state?.gameModeDefinition || null,
      ruleModule: moduleDefinition
    }));
  });

  return results;
}

module.exports = {
  applyRuleHook,
  findRuleModule,
  listRuleModules,
  reinforcementBonusRuleModule,
  resolveEnabledRuleModules
};
