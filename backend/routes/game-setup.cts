import type * as HttpTypes from "node:http";
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
type PersistGameContext = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type PersistWithAiTurns = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type BroadcastGame = (gameContext: any) => void;
type GetTargetGameId = (body?: Record<string, unknown>, url?: URL | null) => string | null;
type AddPlayer = (state: any, name: string, options?: Record<string, unknown>) => any;
type SnapshotForState = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null
) => unknown;
type SnapshotForUser = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null,
  user: AuthContext["user"]
) => unknown;
type Authorize = (action: string, context: Record<string, unknown>) => void;
type GetGame = (gameId: string | null) => Promise<any>;
type GetPlayer = (state: any, playerId: string) => any;
type PlayerBelongsToUser = (player: any, user: AuthContext["user"]) => boolean;
type StartGame = (state: any) => any;

const {
  aiJoinRequestSchema,
  gameIdRequestSchema,
  gameMutationResponseSchema,
  startGameRequestSchema
} = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError, sendValidatedJson } = require("../route-validation.cjs");
const {
  isInvalidExpectedVersion,
  persistBroadcastAndSendMutation,
  readExpectedVersionOrSendError,
  sendVersionConflict
} = require("./game-mutation.cjs");

async function handleAiJoinRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  url: URL,
  requireAuth: RequireAuth,
  loadGameContext: LoadGameContext,
  getTargetGameId: GetTargetGameId,
  getGame: GetGame,
  authorize: Authorize,
  addPlayer: AddPlayer,
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

  const resolvedBody = {
    ...body,
    gameId: getTargetGameId(body, url)
  };
  const parsedBody = parseRequestOrSendError(
    res as HttpTypes.ServerResponse,
    resolvedBody,
    aiJoinRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const gameId = parsedBody.gameId;
  try {
    const activeGame = await getGame(gameId);
    authorize("game:start", { user: authContext.user, game: activeGame.game });
  } catch (error: any) {
    const statusCode = error.statusCode || 403;
    sendLocalizedError(
      res,
      statusCode,
      error,
      "Aggiunta AI non autorizzata.",
      "server.game.aiJoinUnauthorized"
    );
    return;
  }

  const gameContext = await loadGameContext(gameId);
  const result = addPlayer(gameContext.state, parsedBody.name, { isAi: true });
  if (!result.ok) {
    sendLocalizedError(
      res,
      400,
      result,
      result.error,
      result.errorKey || "server.aiJoin.failed",
      result.errorParams
    );
    return;
  }

  await persistGameContext(gameContext);
  broadcastGame(gameContext);
  sendJson(res, result.rejoined ? 200 : 201, {
    playerId: result.player.id,
    state: snapshotForState(
      gameContext.state,
      gameContext.gameId,
      gameContext.version,
      gameContext.gameName
    ),
    player: result.player
  });
}

async function handleJoinRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  url: URL,
  requireAuth: RequireAuth,
  loadGameContext: LoadGameContext,
  getTargetGameId: GetTargetGameId,
  addPlayer: AddPlayer,
  persistGameContext: PersistGameContext,
  broadcastGame: BroadcastGame,
  snapshotForState: SnapshotForState,
  publicUser: (user: unknown) => unknown,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
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
    gameIdRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const gameContext = await loadGameContext(parsedBody.gameId);
  const result = addPlayer(gameContext.state, authContext.user.username, {
    linkedUserId: authContext.user.id
  });
  if (!result.ok) {
    sendLocalizedError(
      res,
      400,
      result,
      result.error,
      result.errorKey || "server.join.failed",
      result.errorParams
    );
    return;
  }

  await persistGameContext(gameContext);
  broadcastGame(gameContext);
  sendValidatedJson(
    res as HttpTypes.ServerResponse,
    result.rejoined ? 200 : 201,
    {
      playerId: result.player.id,
      state: snapshotForState(
        gameContext.state,
        gameContext.gameId,
        gameContext.version,
        gameContext.gameName
      ),
      user: publicUser(authContext.user)
    },
    gameMutationResponseSchema,
    sendJson as SendJson,
    sendLocalizedError as SendLocalizedError
  );
}

async function handleStartRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  url: URL,
  requireAuth: RequireAuth,
  loadGameContext: LoadGameContext,
  getTargetGameId: GetTargetGameId,
  getGame: GetGame,
  authorize: Authorize,
  getPlayer: GetPlayer,
  playerBelongsToUser: PlayerBelongsToUser,
  startGame: StartGame,
  persistWithAiTurns: PersistWithAiTurns,
  broadcastGame: BroadcastGame,
  snapshotForUser: SnapshotForUser,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const authContext = await requireAuth(req, res, body);
  if (!authContext) {
    return;
  }

  const resolvedBody = {
    ...body,
    gameId: getTargetGameId(body, url)
  };
  const parsedBody = parseRequestOrSendError(
    res as HttpTypes.ServerResponse,
    resolvedBody,
    startGameRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const nodeResponse = res as HttpTypes.ServerResponse;
  const expectedVersion = parsedBody.expectedVersion ?? null;

  try {
    const activeGame = await getGame(parsedBody.gameId ?? null);
    authorize("game:start", { user: authContext.user, game: activeGame.game });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    sendLocalizedError(
      res,
      statusCode,
      error,
      "Avvio partita non autorizzato.",
      "server.game.startUnauthorized"
    );
    return;
  }

  const gameContext = await loadGameContext(parsedBody.gameId ?? null);
  if (gameContext.state.phase !== "lobby") {
    sendLocalizedError(res, 400, null, "La partita e gia iniziata.", "server.game.alreadyStarted");
    return;
  }

  if (gameContext.state.players.length < 2) {
    sendLocalizedError(
      res,
      400,
      null,
      "Servono almeno 2 giocatori.",
      "server.game.notEnoughPlayers"
    );
    return;
  }

  if (expectedVersion != null && expectedVersion !== gameContext.version) {
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

  const player = getPlayer(gameContext.state, parsedBody.playerId);
  if (!player || !playerBelongsToUser(player, authContext.user)) {
    sendLocalizedError(res, 403, null, "Giocatore non valido.", "game.invalidPlayer");
    return;
  }

  gameContext.state = structuredClone(gameContext.state);
  startGame(gameContext.state);
  await persistBroadcastAndSendMutation({
    res: nodeResponse,
    gameContext,
    expectedVersion,
    user: authContext.user,
    persistGameContext: persistWithAiTurns,
    broadcastGame,
    snapshotForUser,
    sendJson,
    sendLocalizedError,
    payload: {
      playerId: parsedBody.playerId
    }
  });
}

module.exports = {
  handleAiJoinRoute,
  handleJoinRoute,
  handleStartRoute
};
