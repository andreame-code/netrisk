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

type ObservedResponse = import("node:http").ServerResponse & {
  __netriskRequestContext?: ResponseRequestContext;
  headers?: Record<string, string>;
  setHeader?: (name: string, value: string) => void;
};

function setResponseHeader(res: ObservedResponse, name: string, value: string): void {
  if (typeof res.setHeader === "function") {
    res.setHeader(name, value);
    return;
  }

  if (res.headers && typeof res.headers === "object") {
    res.headers[name] = value;
  }
}

export function setResponseRequestContext(
  res: import("node:http").ServerResponse,
  context: ResponseRequestContext
): void {
  const observedResponse = res as ObservedResponse;
  observedResponse.__netriskRequestContext = context;
  setResponseHeader(observedResponse, "X-Request-Id", context.requestId);
}

function getResponseRequestContext(
  res: import("node:http").ServerResponse
): ResponseRequestContext | null {
  const observedResponse = res as ObservedResponse;
  return observedResponse.__netriskRequestContext || null;
}

function logUnexpectedServerError(
  res: import("node:http").ServerResponse,
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
