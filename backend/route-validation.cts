const { toValidationErrors } = require("../shared/runtime-validation.cjs");

type SendJson = (
  res: import("node:http").ServerResponse,
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

type ValidationSchema<T> = {
  safeParse(
    input: unknown
  ):
    | { success: true; data: T }
    | { success: false; error: { issues?: Array<Record<string, unknown>> } };
};

function sendValidationFailure(
  res: import("node:http").ServerResponse,
  statusCode: number,
  code: "REQUEST_VALIDATION_FAILED" | "RESPONSE_VALIDATION_FAILED",
  error: { issues?: Array<Record<string, unknown>> } | null | undefined,
  sendLocalizedError: SendLocalizedError
): void {
  sendLocalizedError(
    res,
    statusCode,
    null,
    code === "REQUEST_VALIDATION_FAILED" ? "Richiesta non valida." : "Risposta server non valida.",
    code === "REQUEST_VALIDATION_FAILED" ? "server.request.invalid" : "server.response.invalid",
    {},
    code,
    { validationErrors: toValidationErrors(error) }
  );
}

function parseRequestOrSendError<T>(
  res: import("node:http").ServerResponse,
  payload: unknown,
  schema: ValidationSchema<T>,
  sendLocalizedError: SendLocalizedError
): T | null {
  const result = schema.safeParse(payload);
  if (result.success) {
    return result.data;
  }

  sendValidationFailure(res, 400, "REQUEST_VALIDATION_FAILED", result.error, sendLocalizedError);
  return null;
}

function sendValidatedJson<T>(
  res: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
  schema: ValidationSchema<T>,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError,
  headers: Record<string, string> = {}
): boolean {
  const result = schema.safeParse(payload);
  if (!result.success) {
    sendValidationFailure(res, 500, "RESPONSE_VALIDATION_FAILED", result.error, sendLocalizedError);
    return false;
  }

  sendJson(res, statusCode, result.data, headers);
  return true;
}

module.exports = {
  parseRequestOrSendError,
  sendValidatedJson
};
