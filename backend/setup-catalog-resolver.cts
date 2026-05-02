type CatalogEntry = { id: string };
type ResolvedCatalog = {
  ruleSets?: CatalogEntry[];
  victoryRuleSets?: CatalogEntry[];
  themes?: CatalogEntry[];
  pieceSkins?: CatalogEntry[];
};

type ModuleRuntime = {
  findContentPack: (contentPackId: string) => unknown;
  findDiceRuleSet: (diceRuleSetId: string) => unknown;
  findPlayerPieceSet: (pieceSetId: string) => unknown;
  findSupportedMap: (mapId: string) => unknown;
  findVictoryRuleSetRuntime: (victoryRuleSetId: string) => unknown;
  resolveGamePreset: (input: unknown) => unknown;
  resolveGameConfigDefaults: (input: unknown) => unknown;
  resolveGameSelection: (input: unknown) => unknown;
};

const { findCatalogEntry, listFromCatalog, resolvedCatalogFromCarrier } = require("./catalog-view.cjs");

function createSetupCatalogResolver(moduleRuntime: ModuleRuntime, moduleOptions: any) {
  const resolvedCatalog = resolvedCatalogFromCarrier(moduleOptions) as ResolvedCatalog;

  return {
    resolveRuleSet: (ruleSetId: string) => findCatalogEntry(resolvedCatalog, "ruleSets", ruleSetId),
    resolveContentPack: (contentPackId: string) => moduleRuntime.findContentPack(contentPackId),
    resolveDiceRuleSet: (diceRuleSetId: string) => moduleRuntime.findDiceRuleSet(diceRuleSetId),
    resolvePlayerPieceSet: (pieceSetId: string) => moduleRuntime.findPlayerPieceSet(pieceSetId),
    resolveSupportedMap: (mapId: string) => moduleRuntime.findSupportedMap(mapId),
    resolveVictoryRuleSet: (victoryRuleSetId: string) =>
      findCatalogEntry(resolvedCatalog, "victoryRuleSets", victoryRuleSetId),
    resolveVictoryRuleRuntime: (victoryRuleSetId: string) =>
      moduleRuntime.findVictoryRuleSetRuntime(victoryRuleSetId),
    resolveTheme: (themeId: string) => findCatalogEntry(resolvedCatalog, "themes", themeId),
    resolveDefaultTheme: () => listFromCatalog(resolvedCatalog, "themes")[0] || null,
    resolvePieceSkin: (pieceSkinId: string) =>
      findCatalogEntry(resolvedCatalog, "pieceSkins", pieceSkinId),
    resolveGamePreset: (input: unknown) => moduleRuntime.resolveGamePreset(input),
    resolveGameModuleConfigDefaults: (input: unknown) =>
      moduleRuntime.resolveGameConfigDefaults(input),
    resolveGameModuleSelection: (input: unknown) => moduleRuntime.resolveGameSelection(input)
  };
}

module.exports = {
  createSetupCatalogResolver
};
