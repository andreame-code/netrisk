import type * as HttpTypes from "node:http";
const { handleAttackGameActionRoute } = require("./game-actions-attack.cjs");
const { handleBasicGameActionRoute } = require("./game-actions-basic.cjs");
const { sendVersionConflict } = require("./game-mutation.cjs");
const { handleTurnGameActionRoute } = require("./game-actions-turn.cjs");
const {
  gameActionEnvelopeSchema,
  gameActionRequestSchema,
  gameMutationResponseSchema
} = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError, sendValidatedJson } = require("../route-validation.cjs");
const {
  applyFortify,
  applyReinforcement,
  endTurn,
  getPlayer,
  moveAfterConquest,
  resolveAttack,
  surrenderPlayer
} = require("../engine/game-engine.cjs");
const { resolveBanzaiAttack } = require("../engine/banzai-attack.cjs");

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
type LocalizedPayload = (
  error: any,
  fallbackMessage: string,
  fallbackMessageKey?: string
) => Record<string, unknown>;

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
type PlayerBelongsToUser = (player: any, user: AuthContext["user"]) => boolean;
type PersistGameContext = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type PersistWithAiTurns = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type BroadcastGame = (gameContext: any) => void;
type SnapshotForUser = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null,
  user: unknown
) => unknown;
type ConsumeQueuedAttackRandom = () => (() => number) | null;

async function handleGameActionRoute({
  req,
  res,
  body,
  url,
  requireAuth,
  loadGameContext,
  getTargetGameId,
  playerBelongsToUser,
  persistGameContext,
  persistWithAiTurns,
  broadcastGame,
  snapshotForUser,
  consumeQueuedAttackRandom,
  localizedPayload,
  sendJson,
  sendLocalizedError
}: {
  req: unknown;
  res: unknown;
  body: Record<string, any>;
  url: URL;
  requireAuth: RequireAuth;
  loadGameContext: LoadGameContext;
  getTargetGameId: GetTargetGameId;
  playerBelongsToUser: PlayerBelongsToUser;
  persistGameContext: PersistGameContext;
  persistWithAiTurns: PersistWithAiTurns;
  broadcastGame: BroadcastGame;
  snapshotForUser: SnapshotForUser;
  consumeQueuedAttackRandom: ConsumeQueuedAttackRandom;
  localizedPayload: LocalizedPayload;
  sendJson: SendJson;
  sendLocalizedError: SendLocalizedError;
}): Promise<void> {
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
  const parsedEnvelope = parseRequestOrSendError(
    res as HttpTypes.ServerResponse,
    resolvedBody,
    gameActionEnvelopeSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedEnvelope) {
    return;
  }

  const currentUser = authContext.user;
  const playerId = parsedEnvelope.playerId;
  const type = parsedEnvelope.type;
  const expectedVersion = parsedEnvelope.expectedVersion ?? null;
  const nodeResponse = res as HttpTypes.ServerResponse;
  const sendGameplayMutationJson: SendJson = (targetRes, statusCode, payload, headers) => {
    sendValidatedJson(
      targetRes as HttpTypes.ServerResponse,
      statusCode,
      payload,
      gameMutationResponseSchema,
      sendJson as SendJson,
      sendLocalizedError as SendLocalizedError,
      headers
    );
  };

  const gameContext = await loadGameContext(parsedEnvelope.gameId ?? null);
  const player = getPlayer(gameContext.state, playerId);

  if (!player || !playerBelongsToUser(player, currentUser)) {
    sendLocalizedError(res, 403, null, "Giocatore non valido.", "game.invalidPlayer");
    return;
  }

  function handleVersionConflict(error: any) {
    if (!error || error.code !== "VERSION_CONFLICT") {
      return false;
    }

    sendVersionConflict({
      res: nodeResponse,
      error,
      gameContext,
      currentUser,
      snapshotForUser,
      sendJson,
      sendLocalizedError,
      localizedPayload
    });
    return true;
  }

  if (expectedVersion != null && expectedVersion !== gameContext.version) {
    sendVersionConflict({
      res: nodeResponse,
      gameContext,
      currentUser,
      snapshotForUser,
      sendJson,
      sendLocalizedError,
      localizedPayload,
      fallbackMessage:
        "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.",
      fallbackMessageKey: "server.versionConflict"
    });
    return;
  }

  const parsedBody = parseRequestOrSendError(
    nodeResponse,
    resolvedBody,
    gameActionRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  function isValidTerritoryId(id: string) {
    return (
      id &&
      typeof gameContext.state.territories === "object" &&
      Object.prototype.hasOwnProperty.call(gameContext.state.territories, id)
    );
  }

  if (
    await handleBasicGameActionRoute(
      type,
      res,
      body,
      gameContext,
      playerId,
      expectedVersion,
      currentUser,
      applyReinforcement,
      moveAfterConquest,
      applyFortify,
      persistGameContext,
      broadcastGame,
      snapshotForUser,
      handleVersionConflict,
      isValidTerritoryId,
      sendGameplayMutationJson,
      sendLocalizedError
    )
  ) {
    return;
  }

  if (
    await handleAttackGameActionRoute(
      type,
      res,
      body,
      gameContext,
      playerId,
      expectedVersion,
      currentUser,
      resolveAttack,
      resolveBanzaiAttack,
      consumeQueuedAttackRandom,
      persistGameContext,
      broadcastGame,
      snapshotForUser,
      handleVersionConflict,
      isValidTerritoryId,
      sendGameplayMutationJson,
      sendLocalizedError
    )
  ) {
    return;
  }

  if (
    await handleTurnGameActionRoute(
      type,
      res,
      gameContext,
      playerId,
      expectedVersion,
      currentUser,
      endTurn,
      surrenderPlayer,
      persistWithAiTurns,
      broadcastGame,
      snapshotForUser,
      handleVersionConflict,
      sendGameplayMutationJson,
      sendLocalizedError
    )
  ) {
    return;
  }

  sendLocalizedError(res, 400, null, "Azione non supportata.", "server.action.unsupported");
}

module.exports = {
  handleGameActionRoute
};
