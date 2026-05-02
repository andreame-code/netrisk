const {
  setupCompleteRequestSchema,
  setupCompleteResponseSchema,
  setupCreateAdminRequestSchema,
  setupCreateAdminResponseSchema,
  setupStatusResponseSchema
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
  error: unknown,
  message?: string,
  messageKey?: string,
  messageParams?: Record<string, unknown>,
  code?: string,
  extraPayload?: Record<string, unknown>
) => void;

type SetupService = {
  getSetupStatus(): Promise<unknown>;
  createFirstAdmin(input: { username?: string; password?: string }): Promise<any>;
  completeSetup(): Promise<any>;
};

async function handleSetupStatusRoute(
  res: unknown,
  setup: SetupService,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  sendValidatedJson(
    res as import("node:http").ServerResponse,
    200,
    await setup.getSetupStatus(),
    setupStatusResponseSchema,
    sendJson as SendJson,
    sendLocalizedError as SendLocalizedError
  );
}

async function handleSetupCreateAdminRoute(
  res: unknown,
  body: Record<string, any>,
  setup: SetupService,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const parsedBody = parseRequestOrSendError(
    res as import("node:http").ServerResponse,
    body,
    setupCreateAdminRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const result = await setup.createFirstAdmin(parsedBody);
  if (!result.ok) {
    sendLocalizedError(
      res,
      result.statusCode || 400,
      result,
      result.error || "Setup non disponibile.",
      result.errorKey || "setup.unavailable",
      result.errorParams || {},
      result.code || "SETUP_FAILED"
    );
    return;
  }

  sendValidatedJson(
    res as import("node:http").ServerResponse,
    201,
    result,
    setupCreateAdminResponseSchema,
    sendJson as SendJson,
    sendLocalizedError as SendLocalizedError
  );
}

async function handleSetupCompleteRoute(
  res: unknown,
  body: Record<string, any>,
  setup: SetupService,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const parsedBody = parseRequestOrSendError(
    res as import("node:http").ServerResponse,
    body,
    setupCompleteRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const result = await setup.completeSetup();
  if (!result.ok) {
    sendLocalizedError(
      res,
      result.statusCode || 400,
      result,
      result.error || "Setup non disponibile.",
      result.errorKey || "setup.unavailable",
      result.errorParams || {},
      result.code || "SETUP_FAILED"
    );
    return;
  }

  sendValidatedJson(
    res as import("node:http").ServerResponse,
    200,
    result,
    setupCompleteResponseSchema,
    sendJson as SendJson,
    sendLocalizedError as SendLocalizedError
  );
}

module.exports = {
  handleSetupCompleteRoute,
  handleSetupCreateAdminRoute,
  handleSetupStatusRoute
};
