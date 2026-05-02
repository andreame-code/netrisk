const { buildVersionSnapshot } = require("../../shared/compatibility.cjs");
const { versionInfoResponseSchema } = require("../../shared/runtime-validation.cjs");
const { sendValidatedJson } = require("../route-validation.cjs");

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

export async function handleVersionRoute(
  res: import("node:http").ServerResponse,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<boolean> {
  sendValidatedJson(
    res,
    200,
    buildVersionSnapshot(),
    versionInfoResponseSchema,
    sendJson,
    sendLocalizedError
  );
  return true;
}
