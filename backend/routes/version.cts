import type * as HttpTypes from "node:http";
const { buildVersionSnapshot } = require("../../shared/compatibility.cjs");
const { versionInfoResponseSchema } = require("../../shared/runtime-validation.cjs");
const { sendValidatedJson } = require("../route-validation.cjs");

type SendJson = (
  res: HttpTypes.ServerResponse,
  statusCode: number,
  payload: unknown,
  headers?: Record<string, string>
) => void;

type SendLocalizedError = (
  res: HttpTypes.ServerResponse,
  statusCode: number,
  input: Record<string, unknown> | null,
  fallbackMessage: string,
  fallbackKey: string | null,
  fallbackParams?: Record<string, unknown>,
  code?: string | null,
  extra?: Record<string, unknown>
) => void;

export async function handleVersionRoute(
  res: HttpTypes.ServerResponse,
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
