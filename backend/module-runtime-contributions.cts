import type {
  NetRiskContentContribution,
  NetRiskInstalledModule
} from "../shared/netrisk-modules.cjs";

const { CORE_MODULE_ID } = require("../shared/netrisk-modules.cjs");

const CONTENT_CONTRIBUTION_KEYS = [
  "mapIds",
  "siteThemeIds",
  "pieceSkinIds",
  "playerPieceSetIds",
  "contentPackIds",
  "diceRuleSetIds",
  "cardRuleSetIds",
  "victoryRuleSetIds",
  "fortifyRuleSetIds",
  "reinforcementRuleSetIds"
] as const;

type RuntimeMapEntry = { map: { id: string } };
type RuntimeContentPackEntry = { contentPack: { id: string } };
type RuntimePlayerPieceSetEntry = { pieceSet: { id: string } };
type RuntimeDiceRuleSetEntry = { diceRuleSet: { id: string } };
type RuntimeCardRuleSetEntry = { cardRuleSet: { id: string } };
type RuntimeSiteThemeEntry = { theme: { id: string } };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function emptyContentContribution(): NetRiskContentContribution {
  return {
    mapIds: [],
    siteThemeIds: [],
    pieceSkinIds: [],
    playerPieceSetIds: [],
    contentPackIds: [],
    diceRuleSetIds: [],
    cardRuleSetIds: [],
    victoryRuleSetIds: [],
    fortifyRuleSetIds: [],
    reinforcementRuleSetIds: []
  };
}

function aggregateContentContribution(
  modules: NetRiskInstalledModule[],
  runtimeMapEntries: RuntimeMapEntry[] = [],
  runtimeContentPackEntries: RuntimeContentPackEntry[] = [],
  runtimePlayerPieceSetEntries: RuntimePlayerPieceSetEntry[] = [],
  runtimeDiceRuleSetEntries: RuntimeDiceRuleSetEntry[] = [],
  runtimeCardRuleSetEntries: RuntimeCardRuleSetEntry[] = [],
  runtimeSiteThemeEntries: RuntimeSiteThemeEntry[] = []
): NetRiskContentContribution {
  const contribution = emptyContentContribution();

  modules.forEach((moduleEntry) => {
    const content = moduleEntry.clientManifest?.content;
    if (!content) {
      return;
    }

    CONTENT_CONTRIBUTION_KEYS.forEach((key) => {
      const currentValues = contribution[key] || [];
      const nextValues = Array.isArray(content[key]) ? content[key] : [];
      contribution[key] = unique([...currentValues, ...nextValues]);
    });
  });

  if (runtimeMapEntries.length) {
    contribution.mapIds = unique([
      ...(contribution.mapIds || []),
      ...runtimeMapEntries.map((entry) => entry.map.id)
    ]);
  }

  if (runtimeContentPackEntries.length) {
    contribution.contentPackIds = unique([
      ...(contribution.contentPackIds || []),
      ...runtimeContentPackEntries.map((entry) => entry.contentPack.id)
    ]);
  }

  if (runtimePlayerPieceSetEntries.length) {
    contribution.playerPieceSetIds = unique([
      ...(contribution.playerPieceSetIds || []),
      ...runtimePlayerPieceSetEntries.map((entry) => entry.pieceSet.id)
    ]);
  }

  if (runtimeDiceRuleSetEntries.length) {
    contribution.diceRuleSetIds = unique([
      ...(contribution.diceRuleSetIds || []),
      ...runtimeDiceRuleSetEntries.map((entry) => entry.diceRuleSet.id)
    ]);
  }

  if (runtimeCardRuleSetEntries.length) {
    contribution.cardRuleSetIds = unique([
      ...(contribution.cardRuleSetIds || []),
      ...runtimeCardRuleSetEntries.map((entry) => entry.cardRuleSet.id)
    ]);
  }

  if (runtimeSiteThemeEntries.length) {
    contribution.siteThemeIds = unique([
      ...(contribution.siteThemeIds || []),
      ...runtimeSiteThemeEntries.map((entry) => entry.theme.id)
    ]);
  }

  return contribution;
}

function moduleEntriesForSelection(
  modules: NetRiskInstalledModule[],
  moduleIds: string[],
  baselineModuleIds: string[] = [CORE_MODULE_ID]
): NetRiskInstalledModule[] {
  const requestedIds = new Set([...baselineModuleIds, ...moduleIds]);
  return modules.filter((moduleEntry) => requestedIds.has(moduleEntry.id));
}

function ensureAllowedContentId(
  kind: string,
  requestedId: string | null | undefined,
  availableIds: string[] | null | undefined
): void {
  if (!isNonEmptyString(requestedId) || !Array.isArray(availableIds) || !availableIds.length) {
    return;
  }

  if (!availableIds.includes(requestedId)) {
    throw new Error(`Selected ${kind} "${requestedId}" is not exposed by the active modules.`);
  }
}

module.exports = {
  aggregateContentContribution,
  ensureAllowedContentId,
  moduleEntriesForSelection
};
