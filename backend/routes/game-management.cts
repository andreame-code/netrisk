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
type Authorize = (action: string, context: Record<string, unknown>) => any;
type CreateConfiguredInitialState = (body: Record<string, any>) => any;
type AddPlayer = (state: any, name: string, options?: Record<string, unknown>) => any;
type ListGames = () => Promise<any>;
type CreateGame = (state: any, options?: Record<string, unknown>) => Promise<any>;
type GetGame = (gameId: string) => Promise<any>;
type OpenGame = (gameId: string) => Promise<any>;
type ReplaceState = (state: any) => void;
type BroadcastGame = (gameContext: any) => void;
type Snapshot = () => unknown;
type SnapshotForState = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null
) => unknown;
type ResumeAiTurnsForRead = (gameContext: any) => Promise<any>;
type ResolvePlayerForUser = (state: any, user: unknown) => any;

async function handleCreateGameRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  createConfiguredInitialState: CreateConfiguredInitialState,
  addPlayer: AddPlayer,
  createGame: CreateGame,
  listGames: ListGames,
  replaceState: ReplaceState,
  broadcastGame: BroadcastGame,
  snapshot: Snapshot,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const authContext = await requireAuth(req, res, body);
  if (!authContext) {
    return;
  }

  try {
    const policy = authorize("game:create", { user: authContext.user });
    const configured = await createConfiguredInitialState(body);
    const creatorJoin = addPlayer(configured.state, authContext.user.username, {
      linkedUserId: policy.actor.id
    });
    if (!creatorJoin.ok) {
      throw Object.assign(
        new Error(creatorJoin.error || "Impossibile collegare il creatore alla nuova partita."),
        {
          statusCode: 400,
          messageKey: creatorJoin.errorKey || "server.game.create.creatorJoinFailed",
          messageParams: creatorJoin.errorParams
        }
      );
    }

    const created = await createGame(configured.state, {
      ...configured.gameInput,
      creatorUserId: policy.actor.id
    });
    replaceState(created.state);
    broadcastGame({
      gameId: created.game.id,
      gameName: created.game.name,
      version: created.game.version,
      state: created.state
    });
    sendJson(res, 201, {
      ok: true,
      game: created.game,
      games: await listGames(),
      activeGameId: created.game.id,
      state: snapshot(),
      config: configured.config,
      playerId: creatorJoin.player.id
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    sendLocalizedError(
      res,
      statusCode,
      error,
      "Creazione partita non riuscita.",
      "server.game.createFailed"
    );
  }
}

async function handleOpenGameRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  getGame: GetGame,
  openGame: OpenGame,
  listGames: ListGames,
  resumeAiTurnsForRead: ResumeAiTurnsForRead,
  resolvePlayerForUser: ResolvePlayerForUser,
  snapshotForState: SnapshotForState,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const authContext = await requireAuth(req, res, body);
  if (!authContext) {
    return;
  }

  try {
    const gameRecord = await getGame(body.gameId);
    authorize("game:open", {
      user: authContext.user,
      game: gameRecord.game,
      state: gameRecord.state
    });
    const opened = await openGame(body.gameId);
    await resumeAiTurnsForRead(opened);
    const resolvedPlayer = resolvePlayerForUser(opened.state, authContext.user);
    sendJson(res, 200, {
      ok: true,
      game: opened.game,
      games: await listGames(),
      activeGameId: opened.game.id,
      state: snapshotForState(opened.state, opened.game.id, opened.game.version, opened.game.name),
      playerId: resolvedPlayer ? resolvedPlayer.id : null
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    sendLocalizedError(
      res,
      statusCode,
      error,
      "Apertura partita non riuscita.",
      "server.game.openFailed"
    );
  }
}

module.exports = {
  handleCreateGameRoute,
  handleOpenGameRoute
};
