const {
  gameMutationResponseSchema,
  gameVersionConflictResponseSchema,
  tradeCardsRequestSchema
} = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError, sendValidatedJson } = require("../route-validation.cjs");

type SendJson = (
  res: unknown,
  statusCode: number,
  payload: unknown,
  headers?: Record<string, string>
) => void;
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

type RequireAuth = (
  req: unknown,
  res: unknown,
  body: Record<string, any>
) => Promise<AuthContext | null>;
type LoadGameContext = (gameId: string | null) => Promise<any>;
type GetTargetGameId = (body?: Record<string, unknown>, url?: URL | null) => string | null;
type GetPlayer = (state: any, playerId: string) => any;
type PlayerBelongsToUser = (player: any, user: AuthContext["user"]) => boolean;
type TradeCardSet = (state: any, playerId: string, cardIds: string[]) => any;
type PersistGameContext = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type BroadcastGame = (gameContext: any) => void;
type SnapshotForUser = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null,
  user: unknown
) => unknown;

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
  snapshotForUser: SnapshotForUser,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const authContext = await requireAuth(req, res, body);
  if (!authContext) {
    return;
  }

  if (
    body.expectedVersion != null &&
    (!Number.isInteger(Number(body.expectedVersion)) || Number(body.expectedVersion) < 1)
  ) {
    sendLocalizedError(
      res,
      400,
      null,
      "expectedVersion non valida.",
      "server.invalidExpectedVersion"
    );
    return;
  }

  const resolvedBody = {
    ...body,
    gameId: getTargetGameId(body, url)
  };
  const parsedBody = parseRequestOrSendError(
    res as import("node:http").ServerResponse,
    resolvedBody,
    tradeCardsRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const nodeResponse = res as import("node:http").ServerResponse;
  const gameContext = await loadGameContext(parsedBody.gameId ?? null);
  const player = getPlayer(gameContext.state, parsedBody.playerId);
  if (!player || !playerBelongsToUser(player, authContext.user)) {
    sendLocalizedError(res, 403, null, "Giocatore non valido.", "game.invalidPlayer");
    return;
  }

  const requestedVersion = parsedBody.expectedVersion ?? null;
  if (requestedVersion != null && requestedVersion !== gameContext.version) {
    sendValidatedJson(
      nodeResponse,
      409,
      {
        error: "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.",
        messageKey: "server.versionConflict",
        messageParams: {},
        code: "VERSION_CONFLICT",
        currentVersion: gameContext.version,
        state: snapshotForUser(
          gameContext.state,
          gameContext.gameId,
          gameContext.version,
          gameContext.gameName,
          authContext.user
        )
      },
      gameVersionConflictResponseSchema,
      sendJson as SendJson,
      sendLocalizedError as SendLocalizedError
    );
    return;
  }

  const result = tradeCardSet(gameContext.state, parsedBody.playerId, parsedBody.cardIds);
  if (!result.ok) {
    sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
    return;
  }

  try {
    await persistGameContext(gameContext, requestedVersion);
  } catch (error: any) {
    if (error && error.code === "VERSION_CONFLICT") {
      sendValidatedJson(
        nodeResponse,
        409,
        {
          error: error.message,
          messageKey: error.messageKey || "server.versionConflict",
          messageParams: {},
          code: error.code,
          currentVersion: error.currentVersion,
          state: snapshotForUser(
            error.currentState,
            gameContext.gameId,
            error.currentVersion,
            error.game?.name || gameContext.gameName,
            authContext.user
          )
        },
        gameVersionConflictResponseSchema,
        sendJson as SendJson,
        sendLocalizedError as SendLocalizedError
      );
      return;
    }

    throw error;
  }

  broadcastGame(gameContext);
  sendValidatedJson(
    nodeResponse,
    200,
    {
      ok: true,
      bonus: result.bonus,
      validation: result.validation,
      state: snapshotForUser(
        gameContext.state,
        gameContext.gameId,
        gameContext.version,
        gameContext.gameName,
        authContext.user
      )
    },
    gameMutationResponseSchema,
    sendJson as SendJson,
    sendLocalizedError as SendLocalizedError
  );
}

module.exports = {
  handleCardsTradeRoute
};
