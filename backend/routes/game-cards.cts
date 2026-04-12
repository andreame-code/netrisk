type SendJson = (res: unknown, statusCode: number, payload: unknown, headers?: Record<string, string>) => void;
type SendLocalizedError = (
  res: unknown,
  statusCode: number,
  error: any,
  message?: string,
  messageKey?: string,
  messageParams?: Record<string, unknown>,
  code?: string,
  extraPayload?: Record<string, unknown>
) => void;

type AuthContext = {
  user: {
    id: string;
    username: string;
  };
};

type RequireAuth = (req: unknown, res: unknown, body: Record<string, any>) => Promise<AuthContext | null>;
type LoadGameContext = (gameId: string | null) => Promise<any>;
type GetTargetGameId = (body?: Record<string, unknown>, url?: URL | null) => string | null;
type GetPlayer = (state: any, playerId: string) => any;
type PlayerBelongsToUser = (player: any, user: AuthContext["user"]) => boolean;
type TradeCardSet = (state: any, playerId: string, cardIds: string[]) => any;
type PersistGameContext = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type BroadcastGame = (gameContext: any) => void;
type SnapshotForState = (state: any, gameId: string | null, version: number | null, gameName: string | null) => unknown;

async function handleCardsTradeRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  url: URL,
  requireAuth: RequireAuth,
  loadGameContext: LoadGameContext,
  getTargetGameId: GetTargetGameId,
  getPlayer: GetPlayer,
  playerBelongsToUser: PlayerBelongsToUser,
  tradeCardSet: TradeCardSet,
  persistGameContext: PersistGameContext,
  broadcastGame: BroadcastGame,
  snapshotForState: SnapshotForState,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const authContext = await requireAuth(req, res, body);
  if (!authContext) {
    return;
  }

  const gameContext = await loadGameContext(getTargetGameId(body, url));
  const player = getPlayer(gameContext.state, body.playerId);
  if (!player || !playerBelongsToUser(player, authContext.user)) {
    sendLocalizedError(res, 403, null, "Giocatore non valido.", "game.invalidPlayer");
    return;
  }

  const requestedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion);
  if (body.expectedVersion != null && (!Number.isInteger(requestedVersion ?? NaN) || (requestedVersion ?? 0) < 1)) {
    sendLocalizedError(res, 400, null, "expectedVersion non valida.", "server.invalidExpectedVersion");
    return;
  }
  if (requestedVersion != null && requestedVersion !== gameContext.version) {
    sendLocalizedError(res, 409, null, "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.", "server.versionConflict", {}, "VERSION_CONFLICT", {
      currentVersion: gameContext.version,
      state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName)
    });
    return;
  }

  const result = tradeCardSet(gameContext.state, body.playerId, body.cardIds);
  if (!result.ok) {
    sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
    return;
  }

  try {
    await persistGameContext(gameContext, requestedVersion);
  } catch (error: any) {
    if (error && error.code === "VERSION_CONFLICT") {
      sendLocalizedError(res, 409, error, error.message, error.messageKey || "server.versionConflict", {}, error.code, {
        currentVersion: error.currentVersion,
        state: snapshotForState(error.currentState, gameContext.gameId, error.currentVersion, error.game?.name || gameContext.gameName)
      });
      return;
    }

    throw error;
  }

  broadcastGame(gameContext);
  sendJson(res, 200, {
    ok: true,
    bonus: result.bonus,
    validation: result.validation,
    state: snapshotForState(gameContext.state, gameContext.gameId, gameContext.version, gameContext.gameName)
  });
}

module.exports = {
  handleCardsTradeRoute
};
