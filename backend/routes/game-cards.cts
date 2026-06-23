import type * as HttpTypes from "node:http";
const { tradeCardsRequestSchema } = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError } = require("../route-validation.cjs");
const {
  isInvalidExpectedVersion,
  persistBroadcastAndSendMutation,
  readExpectedVersionOrSendError,
  sendVersionConflict
} = require("./game-mutation.cjs");
const { createAuthThrottleKey } = require("../auth-attempt-throttle.cjs");
const { sendTooManyAttemptsError } = require("../http-response.cjs");

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
import type { AuthAttemptThrottle } from "../auth-attempt-throttle.cts";

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
  sendLocalizedError: SendLocalizedError,
  authAttemptThrottle?: AuthAttemptThrottle
): Promise<void> {
  const authContext = await requireAuth(req, res, body);
  if (!authContext) {
    return;
  }

  const preflightExpectedVersion = readExpectedVersionOrSendError(
    body,
    res,
    sendLocalizedError as SendLocalizedError
  );
  if (isInvalidExpectedVersion(preflightExpectedVersion)) {
    return;
  }

  const resolvedBody = {
    ...body,
    gameId: getTargetGameId(body, url)
  };
  const parsedBody = parseRequestOrSendError(
    res as HttpTypes.ServerResponse,
    resolvedBody,
    tradeCardsRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const nodeResponse = res as HttpTypes.ServerResponse;

  const throttleKey = authAttemptThrottle
    ? createAuthThrottleKey("game_trade", req, authContext.user.username)
    : null;
  if (authAttemptThrottle && throttleKey) {
    const throttleDecision = authAttemptThrottle.check(throttleKey);
    if (!throttleDecision.allowed) {
      sendTooManyAttemptsError(
        nodeResponse,
        throttleDecision.retryAfterSeconds,
        "Troppi tentativi di scambio carte. Riprova più tardi.",
        sendLocalizedError as SendLocalizedError
      );
      return;
    }
    authAttemptThrottle.recordAttempt(throttleKey);
  }

  const gameContext = await loadGameContext(parsedBody.gameId ?? null);
  const player = getPlayer(gameContext.state, parsedBody.playerId);
  if (!player || !playerBelongsToUser(player, authContext.user)) {
    sendLocalizedError(res, 403, null, "Giocatore non valido.", "game.invalidPlayer");
    return;
  }

  const requestedVersion = preflightExpectedVersion;
  if (requestedVersion != null && requestedVersion !== gameContext.version) {
    sendVersionConflict({
      res: nodeResponse,
      gameContext,
      currentUser: authContext.user,
      snapshotForUser,
      sendJson,
      sendLocalizedError,
      fallbackMessage:
        "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.",
      fallbackMessageKey: "server.versionConflict"
    });
    return;
  }

  const result = tradeCardSet(gameContext.state, parsedBody.playerId, parsedBody.cardIds);
  if (!result.ok) {
    sendLocalizedError(res, 400, result, result.message, result.messageKey, result.messageParams);
    return;
  }

  await persistBroadcastAndSendMutation({
    res: nodeResponse,
    gameContext,
    expectedVersion: requestedVersion,
    user: authContext.user,
    persistGameContext,
    broadcastGame,
    snapshotForUser,
    sendJson,
    sendLocalizedError,
    payload: {
      bonus: result.bonus,
      validation: result.validation
    }
  });
}

module.exports = {
  handleCardsTradeRoute
};
