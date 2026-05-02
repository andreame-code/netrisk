type SendJson = (res: unknown, statusCode: number, payload: unknown) => void;

type ListGames = () => Promise<unknown> | unknown;
type GetTargetGameId = (body?: Record<string, unknown>, url?: URL | null) => string | null;
type GameOptionsResolvedCatalog = {
  modules?: unknown[];
  enabledModules?: unknown[];
  gameModules?: unknown[];
  maps?: unknown[];
  ruleSets?: unknown[];
  playerPieceSets?: unknown[];
  diceRuleSets?: unknown[];
  contentPacks?: unknown[];
  victoryRuleSets?: unknown[];
  themes?: unknown[];
  pieceSkins?: unknown[];
  gamePresets?: unknown[];
  uiSlots?: unknown[];
  contentProfiles?: unknown[];
  gameplayProfiles?: unknown[];
  uiProfiles?: unknown[];
};
type GetResolvedCatalog = () => Promise<GameOptionsResolvedCatalog> | GameOptionsResolvedCatalog;
type ListTurnTimeoutHoursOptions = () => unknown;
type GetExtraGameOptions = () => Record<string, unknown> | Promise<Record<string, unknown>>;
type SendLocalizedError = (
  res: import("node:http").ServerResponse,
  statusCode: number,
  input: Record<string, unknown> | null,
  fallbackMessage: string,
  fallbackKey: string | null,
  fallbackParams?: Record<string, unknown>,
  code?: string | null,
  extra?: Record<string, unknown>
) => void;

const {
  gameListResponseSchema,
  gameOptionsResponseSchema
} = require("../../shared/runtime-validation.cjs");
const { listEntries, resolvedCatalogFromCarrier } = require("../catalog-view.cjs");
const { sendValidatedJson } = require("../route-validation.cjs");

async function handleGamesListRoute(
  res: unknown,
  listGames: ListGames,
  getTargetGameId: GetTargetGameId,
  sendJson: SendJson,
  url: URL,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  sendValidatedJson(
    res as import("node:http").ServerResponse,
    200,
    {
      games: await listGames(),
      activeGameId: getTargetGameId({}, url)
    },
    gameListResponseSchema,
    sendJson as SendJson,
    sendLocalizedError
  );
}

async function handleGameOptionsRoute(
  res: unknown,
  getResolvedCatalog: GetResolvedCatalog,
  listTurnTimeoutHoursOptions: ListTurnTimeoutHoursOptions,
  sendJson: SendJson,
  getExtraGameOptions?: GetExtraGameOptions,
  sendLocalizedError?: SendLocalizedError
): Promise<void> {
  const resolvedCatalog = resolvedCatalogFromCarrier(
    await getResolvedCatalog()
  ) as GameOptionsResolvedCatalog;
  const payload = {
    ruleSets: listEntries(resolvedCatalog.ruleSets),
    maps: listEntries(resolvedCatalog.maps),
    diceRuleSets: listEntries(resolvedCatalog.diceRuleSets),
    victoryRuleSets: listEntries(resolvedCatalog.victoryRuleSets),
    themes: listEntries(resolvedCatalog.themes),
    pieceSkins: listEntries(resolvedCatalog.pieceSkins),
    modules: listEntries(resolvedCatalog.gameModules || resolvedCatalog.modules),
    enabledModules: listEntries(resolvedCatalog.enabledModules),
    gamePresets: listEntries(resolvedCatalog.gamePresets),
    contentProfiles: listEntries(resolvedCatalog.contentProfiles),
    gameplayProfiles: listEntries(resolvedCatalog.gameplayProfiles),
    uiProfiles: listEntries(resolvedCatalog.uiProfiles),
    uiSlots: listEntries(resolvedCatalog.uiSlots),
    playerPieceSets: listEntries(resolvedCatalog.playerPieceSets),
    contentPacks: listEntries(resolvedCatalog.contentPacks),
    resolvedCatalog,
    turnTimeoutHoursOptions: listTurnTimeoutHoursOptions(),
    playerRange: { min: 2, max: 4 },
    ...(typeof getExtraGameOptions === "function" ? await getExtraGameOptions() : {})
  };

  if (!sendLocalizedError) {
    sendJson(res, 200, payload);
    return;
  }

  sendValidatedJson(
    res as import("node:http").ServerResponse,
    200,
    payload,
    gameOptionsResponseSchema,
    sendJson as SendJson,
    sendLocalizedError
  );
}

module.exports = {
  handleGamesListRoute,
  handleGameOptionsRoute
};
