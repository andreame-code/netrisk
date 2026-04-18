const {
  gameEventPayloadSchema,
  gameStateResponseSchema,
  toValidationErrors
} = require("../../shared/runtime-validation.cjs");
const { sendValidatedJson } = require("../route-validation.cjs");

type SendJson = (
  res: unknown,
  statusCode: number,
  payload: unknown,
  headers?: Record<string, string>
) => void;
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
type AuthorizeGameRead = (
  gameId: string | null,
  req: unknown,
  res: unknown,
  url: URL
) => Promise<any>;
type GetTargetGameId = (body?: Record<string, unknown>, url?: URL | null) => string | null;
type LoadGameContext = (gameId: string | null) => Promise<any>;
type ResumeAiTurnsForRead = (gameContext: any) => Promise<any>;
type SnapshotForUser = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null,
  user: unknown
) => unknown;
type ExtractSessionToken = (
  req: unknown,
  body?: Record<string, unknown>,
  url?: URL | null
) => string | null;
type GetUserFromSession = (sessionToken: string | null) => Promise<unknown>;

async function handleStateRoute(
  req: unknown,
  res: unknown,
  url: URL,
  authorizeGameRead: AuthorizeGameRead,
  getTargetGameId: GetTargetGameId,
  loadGameContext: LoadGameContext,
  resumeAiTurnsForRead: ResumeAiTurnsForRead,
  getUserFromSession: GetUserFromSession,
  extractSessionToken: ExtractSessionToken,
  snapshotForUser: SnapshotForUser,
  sendJson: SendJson,
  sendLocalizedError?: SendLocalizedError
): Promise<void> {
  const gameId = getTargetGameId({}, url);
  const access = await authorizeGameRead(gameId, req, res, url);
  if (access === null) {
    return;
  }

  const gameContext = await loadGameContext(gameId);
  await resumeAiTurnsForRead(gameContext);
  const sessionUser =
    access && access.user
      ? access.user
      : await getUserFromSession(extractSessionToken(req, {}, url));
  const payload = snapshotForUser(
    gameContext.state,
    gameContext.gameId,
    gameContext.version,
    gameContext.gameName,
    sessionUser
  );
  if (typeof sendLocalizedError !== "function") {
    sendJson(res, 200, payload);
    return;
  }

  sendValidatedJson(
    res as import("node:http").ServerResponse,
    200,
    payload,
    gameStateResponseSchema,
    sendJson as SendJson,
    sendLocalizedError
  );
}

async function handleEventsRoute(
  req: any,
  res: any,
  url: URL,
  authorizeGameRead: AuthorizeGameRead,
  getTargetGameId: GetTargetGameId,
  loadGameContext: LoadGameContext,
  resumeAiTurnsForRead: ResumeAiTurnsForRead,
  snapshotForUser: SnapshotForUser,
  clientsByGameId: Map<string, Set<{ res: any; user: unknown }>>,
  sendLocalizedError?: SendLocalizedError
): Promise<void> {
  const gameId = getTargetGameId({}, url);
  const access = await authorizeGameRead(gameId, req, res, url);
  if (access === null) {
    return;
  }

  const gameContext = await loadGameContext(gameId);
  // Keep the event stream read-only. AI advancement already happens on open/state routes.
  const initialPayload = snapshotForUser(
    gameContext.state,
    gameContext.gameId,
    gameContext.version,
    gameContext.gameName,
    access.user || null
  );
  const initialPayloadResult =
    typeof sendLocalizedError === "function"
      ? gameEventPayloadSchema.safeParse(initialPayload)
      : { success: true, data: initialPayload };
  if (!initialPayloadResult.success) {
    if (typeof sendLocalizedError !== "function") {
      return;
    }

    sendLocalizedError(
      res as import("node:http").ServerResponse,
      500,
      null,
      "Risposta server non valida.",
      "server.response.invalid",
      {},
      "RESPONSE_VALIDATION_FAILED",
      { validationErrors: toValidationErrors(initialPayloadResult.error) }
    );
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write("data: " + JSON.stringify(initialPayloadResult.data) + "\n\n");
  const key = gameContext.gameId || "__default__";
  if (!clientsByGameId.has(key)) {
    clientsByGameId.set(key, new Set());
  }
  const client = { res, user: access.user || null };
  clientsByGameId.get(key)?.add(client);
  req.on("close", () => {
    const group = clientsByGameId.get(key);
    if (!group) {
      return;
    }
    group.delete(client);
    if (!group.size) {
      clientsByGameId.delete(key);
    }
  });
}

module.exports = {
  handleEventsRoute,
  handleStateRoute
};
