type SendJson = (res: unknown, statusCode: number, payload: unknown) => void;

type ListGames = () => Promise<unknown> | unknown;
type GetTargetGameId = (body?: Record<string, unknown>, url?: URL | null) => string | null;
type ListRuleSets = () => unknown;
type ListMaps = () => unknown;
type ListDiceRuleSets = () => unknown;
type ListVictoryRuleSets = () => unknown;
type ListThemes = () => unknown;
type ListPieceSkins = () => unknown;
type ListTurnTimeoutHoursOptions = () => unknown;
type ListPlayerPieceSets = () => unknown;
type ListContentPacks = () => unknown;
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
  listRuleSets: ListRuleSets,
  listMaps: ListMaps,
  listDiceRuleSets: ListDiceRuleSets,
  listVictoryRuleSets: ListVictoryRuleSets,
  listThemes: ListThemes,
  listPieceSkins: ListPieceSkins,
  listTurnTimeoutHoursOptions: ListTurnTimeoutHoursOptions,
  sendJson: SendJson,
  listPlayerPieceSets?: ListPlayerPieceSets,
  listContentPacks?: ListContentPacks,
  getExtraGameOptions?: GetExtraGameOptions,
  sendLocalizedError?: SendLocalizedError
): Promise<void> {
  const payload = {
    ruleSets: listRuleSets(),
    maps: listMaps(),
    diceRuleSets: listDiceRuleSets(),
    victoryRuleSets: listVictoryRuleSets(),
    themes: listThemes(),
    pieceSkins: listPieceSkins(),
    playerPieceSets: typeof listPlayerPieceSets === "function" ? listPlayerPieceSets() : [],
    contentPacks: typeof listContentPacks === "function" ? listContentPacks() : [],
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
