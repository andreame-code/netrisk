import type * as HttpTypes from "node:http";
const {
  gameMutationResponseSchema,
  gameVersionConflictResponseSchema
} = require("../../shared/runtime-validation.cjs");
const { sendValidatedJson } = require("../route-validation.cjs");

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
type PersistGameContext = (gameContext: any, expectedVersion?: number | null) => Promise<any>;
type BroadcastGame = (gameContext: any) => void;
type SnapshotForUser = (
  state: any,
  gameId: string | null,
  version: number | null,
  gameName: string | null,
  user: unknown
) => unknown;
type LocalizedPayload = (
  error: any,
  fallbackMessage: string,
  fallbackMessageKey?: string
) => Record<string, unknown>;
type HandleVersionConflict = (error: unknown) => boolean;
const invalidExpectedVersion = Symbol("invalidExpectedVersion");

type VersionConflictOptions = {
  res: unknown;
  error?: any;
  gameContext: any;
  currentUser: unknown;
  snapshotForUser: SnapshotForUser;
  sendJson: SendJson;
  sendLocalizedError: SendLocalizedError;
  localizedPayload?: LocalizedPayload;
  fallbackMessage?: string;
  fallbackMessageKey?: string;
};

type MutationOptions = {
  res: unknown;
  gameContext: any;
  expectedVersion: number | null;
  user: unknown;
  persistGameContext: PersistGameContext;
  broadcastGame: BroadcastGame;
  snapshotForUser: SnapshotForUser;
  sendJson: SendJson;
  sendLocalizedError: SendLocalizedError;
  localizedPayload?: LocalizedPayload;
  handleVersionConflict?: HandleVersionConflict;
  payload?: Record<string, unknown>;
};

type ExpectedVersionResult = number | null | typeof invalidExpectedVersion;

function readExpectedVersionOrSendError(
  body: Record<string, unknown>,
  res: unknown,
  sendLocalizedError: SendLocalizedError
): ExpectedVersionResult {
  if (body.expectedVersion == null) {
    return null;
  }

  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    sendLocalizedError(
      res,
      400,
      null,
      "expectedVersion non valida.",
      "server.invalidExpectedVersion"
    );
    return invalidExpectedVersion;
  }

  return expectedVersion;
}

function isInvalidExpectedVersion(
  expectedVersion: ExpectedVersionResult
): expectedVersion is typeof invalidExpectedVersion {
  return expectedVersion === invalidExpectedVersion;
}

function conflictPayload(options: VersionConflictOptions): Record<string, unknown> {
  const error = options.error || null;
  const currentVersion =
    error && typeof error.currentVersion === "number"
      ? error.currentVersion
      : options.gameContext.version;
  const currentState =
    error && "currentState" in error ? error.currentState : options.gameContext.state;
  const gameName =
    error?.game?.name || options.gameContext.gameName || options.gameContext.game?.name || null;
  const fallbackMessage =
    options.fallbackMessage ||
    error?.message ||
    "La partita e stata aggiornata da un'altra richiesta. Ricarica lo stato piu recente.";
  const fallbackMessageKey =
    options.fallbackMessageKey || error?.messageKey || "server.versionConflict";
  const localized = options.localizedPayload
    ? options.localizedPayload(error, fallbackMessage, fallbackMessageKey)
    : {
        error: fallbackMessage,
        messageKey: fallbackMessageKey,
        messageParams: {}
      };

  return {
    ...localized,
    code: "VERSION_CONFLICT",
    currentVersion,
    state: options.snapshotForUser(
      currentState,
      options.gameContext.gameId,
      currentVersion,
      gameName,
      options.currentUser
    )
  };
}

function sendVersionConflict(options: VersionConflictOptions): void {
  sendValidatedJson(
    options.res as HttpTypes.ServerResponse,
    409,
    conflictPayload(options),
    gameVersionConflictResponseSchema,
    options.sendJson as SendJson,
    options.sendLocalizedError as SendLocalizedError
  );
}

async function persistBroadcastAndSendMutation(options: MutationOptions): Promise<void> {
  try {
    await options.persistGameContext(options.gameContext, options.expectedVersion);
  } catch (error: any) {
    if (options.handleVersionConflict?.(error)) {
      return;
    }

    if (error && error.code === "VERSION_CONFLICT") {
      sendVersionConflict({
        res: options.res,
        error,
        gameContext: options.gameContext,
        currentUser: options.user,
        snapshotForUser: options.snapshotForUser,
        sendJson: options.sendJson,
        sendLocalizedError: options.sendLocalizedError,
        localizedPayload: options.localizedPayload
      });
      return;
    }

    throw error;
  }

  options.broadcastGame(options.gameContext);
  sendValidatedJson(
    options.res as HttpTypes.ServerResponse,
    200,
    {
      ok: true,
      ...(options.payload || {}),
      state: options.snapshotForUser(
        options.gameContext.state,
        options.gameContext.gameId,
        options.gameContext.version,
        options.gameContext.gameName,
        options.user
      )
    },
    gameMutationResponseSchema,
    options.sendJson as SendJson,
    options.sendLocalizedError as SendLocalizedError
  );
}

module.exports = {
  isInvalidExpectedVersion,
  persistBroadcastAndSendMutation,
  readExpectedVersionOrSendError,
  sendVersionConflict
};
