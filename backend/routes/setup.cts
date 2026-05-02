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

function firstHeaderValue(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return String(value || "")
    .split(",")[0]
    .trim();
}

function isLoopbackAddress(value: unknown): boolean {
  const address = String(value || "")
    .trim()
    .toLowerCase();
  return (
    address === "::1" ||
    address === "[::1]" ||
    address === "0:0:0:0:0:0:0:1" ||
    address === "localhost" ||
    address === "::ffff:127.0.0.1" ||
    /^127(?:\.\d{1,3}){3}$/.test(address)
  );
}

function hostnameFromHostHeader(value: unknown): string {
  const host = firstHeaderValue(value).toLowerCase();
  if (host.startsWith("[")) {
    const closingBracketIndex = host.indexOf("]");
    return closingBracketIndex >= 0 ? host.slice(0, closingBracketIndex + 1) : host;
  }

  return host.split(":")[0] || "";
}

function isTrustedSetupRequest(req: unknown): boolean {
  const request = req as
    | {
        headers?: Record<string, unknown>;
        socket?: {
          remoteAddress?: string;
        };
      }
    | null
    | undefined;
  const forwardedFor = firstHeaderValue(request?.headers?.["x-forwarded-for"]);
  const remoteAddress = request?.socket?.remoteAddress;
  const host = hostnameFromHostHeader(request?.headers?.host);

  if (!isLoopbackAddress(remoteAddress) || !isLoopbackAddress(host)) {
    return false;
  }

  return !forwardedFor || isLoopbackAddress(forwardedFor);
}

function sendUntrustedSetupError(res: unknown, sendLocalizedError: SendLocalizedError): boolean {
  sendLocalizedError(
    res,
    403,
    null,
    "Setup admin disponibile solo da localhost.",
    "setup.localOnly",
    {},
    "SETUP_LOCAL_ONLY"
  );
  return true;
}

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
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  setup: SetupService,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  if (!isTrustedSetupRequest(req)) {
    sendUntrustedSetupError(res, sendLocalizedError);
    return;
  }

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
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  setup: SetupService,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  if (!isTrustedSetupRequest(req)) {
    sendUntrustedSetupError(res, sendLocalizedError);
    return;
  }

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
  handleSetupStatusRoute,
  isTrustedSetupRequest
};
