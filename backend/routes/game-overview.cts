type SendJson = (res: unknown, statusCode: number, payload: unknown) => void;

type ListGames = () => Promise<unknown> | unknown;
type GetTargetGameId = (body?: Record<string, unknown>, url?: URL | null) => string | null;
type ListRuleSets = () => unknown;
type ListMaps = () => unknown;
type ListDiceRuleSets = () => unknown;
type ListVictoryRuleSets = () => unknown;
type ListPlayerPieceSets = () => unknown;
type ListContentPacks = () => unknown;
type ListTurnTimeoutHoursOptions = () => unknown;

async function handleGamesListRoute(
  res: unknown,
  listGames: ListGames,
  getTargetGameId: GetTargetGameId,
  sendJson: SendJson,
  url: URL
): Promise<void> {
  sendJson(res, 200, {
    games: await listGames(),
    activeGameId: getTargetGameId({}, url)
  });
}

function handleGameOptionsRoute(
  res: unknown,
  listRuleSets: ListRuleSets,
  listMaps: ListMaps,
  listDiceRuleSets: ListDiceRuleSets,
  listVictoryRuleSets: ListVictoryRuleSets,
  listPlayerPieceSets: ListPlayerPieceSets,
  listContentPacks: ListContentPacks,
  listTurnTimeoutHoursOptions: ListTurnTimeoutHoursOptions,
  sendJson: SendJson
): void {
  sendJson(res, 200, {
    ruleSets: listRuleSets(),
    maps: listMaps(),
    diceRuleSets: listDiceRuleSets(),
    victoryRuleSets: listVictoryRuleSets(),
    playerPieceSets: listPlayerPieceSets(),
    contentPacks: listContentPacks(),
    turnTimeoutHoursOptions: listTurnTimeoutHoursOptions(),
    playerRange: { min: 2, max: 4 }
  });
}

module.exports = {
  handleGamesListRoute,
  handleGameOptionsRoute
};
