interface LocalizedPayloadInput {
  message?: string;
  error?: string;
  reason?: string;
  defaultMessage?: string;
  messageKey?: string | null;
  errorKey?: string | null;
  reasonKey?: string | null;
  messageParams?: Record<string, unknown>;
  errorParams?: Record<string, unknown>;
  reasonParams?: Record<string, unknown>;
  code?: string | null;
}

export function sendJson(
  res: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
  headers: Record<string, string> = {}
): void {
  if (res.headersSent || res.writableEnded) {
    return;
  }

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

export function localizedPayload(
  input: LocalizedPayloadInput | null | undefined,
  fallbackMessage: string,
  fallbackKey: string | null,
  fallbackParams: Record<string, unknown> = {}
): {
  error: string;
  messageKey: string | null;
  messageParams: Record<string, unknown>;
} {
  const isObject = Boolean(input) && typeof input === "object";
  const message = isObject
    ? input?.message || input?.error || input?.reason || input?.defaultMessage || fallbackMessage
    : fallbackMessage;
  const messageKey = isObject
    ? input?.messageKey || input?.errorKey || input?.reasonKey || null
    : null;
  const messageParams = isObject
    ? input?.messageParams || input?.errorParams || input?.reasonParams || {}
    : {};

  return {
    error: message || fallbackMessage,
    messageKey: messageKey || fallbackKey || null,
    messageParams: messageKey ? messageParams : fallbackKey ? fallbackParams : {}
  };
}

export function sendLocalizedError(
  res: import("node:http").ServerResponse,
  statusCode: number,
  input: LocalizedPayloadInput | null | undefined,
  fallbackMessage: string,
  fallbackKey: string | null,
  fallbackParams: Record<string, unknown> = {},
  code: string | null = null,
  extra: Record<string, unknown> = {}
): void {
  const payload = localizedPayload(input, fallbackMessage, fallbackKey, fallbackParams);
  sendJson(res, statusCode, {
    ...payload,
    code: code || input?.code || null,
    ...extra
  });
}
