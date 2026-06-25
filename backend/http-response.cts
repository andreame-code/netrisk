import type * as HttpTypes from "node:http";
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

type ResponseRequestContext = {
  requestId: string;
  method: string;
  path: string;
  release: string;
  errorLogged?: boolean;
};

type ObservedResponse = HttpTypes.ServerResponse & {
  __netriskRequestContext?: ResponseRequestContext;
  headers?: Record<string, string>;
  setHeader?: (name: string, value: string) => void;
};

export function setResponseHeader(res: unknown, name: string, value: string): void {
  if (!res || typeof res !== "object") {
    return;
  }

  const observedResponse = res as ObservedResponse;
  if (typeof observedResponse.setHeader === "function") {
    observedResponse.setHeader(name, value);
    return;
  }

  if (observedResponse.headers && typeof observedResponse.headers === "object") {
    observedResponse.headers[name] = value;
  }
}

export function setRetryAfterHeader(res: unknown, retryAfterSeconds: number): void {
  const delaySeconds = Math.max(0, Math.ceil(Number(retryAfterSeconds) || 0));
  setResponseHeader(res, "Retry-After", String(delaySeconds));
}

export function setResponseRequestContext(
  res: HttpTypes.ServerResponse,
  context: ResponseRequestContext
): void {
  const observedResponse = res as ObservedResponse;
  observedResponse.__netriskRequestContext = context;
  setResponseHeader(observedResponse, "X-Request-Id", context.requestId);
}

function getResponseRequestContext(res: HttpTypes.ServerResponse): ResponseRequestContext | null {
  const observedResponse = res as ObservedResponse;
  return observedResponse.__netriskRequestContext || null;
}

function logUnexpectedServerError(
  res: HttpTypes.ServerResponse,
  statusCode: number,
  payload: {
    error: string;
  },
  code: string | null,
  input: LocalizedPayloadInput | null | undefined
): void {
  if (statusCode < 500) {
    return;
  }

  const context = getResponseRequestContext(res);
  if (!context || context.errorLogged) {
    return;
  }

  context.errorLogged = true;

  const inputError = input instanceof Error ? input : null;
  console.error(
    JSON.stringify({
      event: "api_unexpected_error",
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      release: context.release,
      statusCode,
      code,
      message: payload.error,
      errorName: inputError?.name || null,
      stack: inputError?.stack || null
    })
  );
}

export function sendJson(
  res: HttpTypes.ServerResponse,
  statusCode: number,
  payload: unknown,
  headers: Record<string, string> = {}
): void {
  if (res.headersSent || res.writableEnded) {
    return;
  }

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
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
  res: HttpTypes.ServerResponse,
  statusCode: number,
  input: LocalizedPayloadInput | null | undefined,
  fallbackMessage: string,
  fallbackKey: string | null,
  fallbackParams: Record<string, unknown> = {},
  code: string | null = null,
  extra: Record<string, unknown> = {}
): void {
  const isInternalError = statusCode >= 500;

  // We always compute the "raw" payload and code for server-side logging first.
  const rawPayload = localizedPayload(input, fallbackMessage, fallbackKey, fallbackParams);
  const rawCode = code || input?.code || null;
  logUnexpectedServerError(res, statusCode, rawPayload, rawCode, input);

  // For internal errors, we MUST NOT leak the raw input details to the client.
  // We compute a sanitized version of the payload and code for the response.
  const sanitizedPayload = isInternalError
    ? localizedPayload(null, fallbackMessage, fallbackKey, fallbackParams)
    : rawPayload;

  const sanitizedCode = isInternalError ? code || null : rawCode;

  sendJson(res, statusCode, {
    ...sanitizedPayload,
    code: sanitizedCode,
    ...(isInternalError ? {} : extra)
  });
}

export function sendTooManyAttemptsError(
  res: HttpTypes.ServerResponse,
  retryAfterSeconds: number,
  fallbackMessage: string,
  sendLocalizedErrorFn: typeof sendLocalizedError
): void {
  setRetryAfterHeader(res, retryAfterSeconds);
  sendLocalizedErrorFn(
    res,
    429,
    {
      error: fallbackMessage,
      errorKey: "auth.throttle.tooManyAttempts",
      errorParams: { retryAfterSeconds },
      code: "AUTH_RATE_LIMITED"
    },
    fallbackMessage,
    "auth.throttle.tooManyAttempts",
    { retryAfterSeconds },
    "AUTH_RATE_LIMITED",
    { retryAfterSeconds }
  );
}
