import {
  parseWithSchema,
  transportErrorPayloadSchema
} from "../../generated/shared-runtime-validation.mjs";
import type {
  TransportErrorPayload,
  ValidationError
} from "../../generated/shared-runtime-validation.mjs";
import { translateServerMessage } from "../../i18n.mjs";
import { reportFrontendException } from "../observability.mjs";
import { readValidatedJson } from "../validated-json.mjs";

type ValidationSchema<T> = {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
};

export type ApiClientKind = "network" | "http" | "request_validation" | "response_validation";
export type ApiErrorCategory =
  | "network"
  | "auth"
  | "business"
  | "validation"
  | "version_conflict"
  | "unexpected_5xx";

export type ApiClientError = Error & {
  code?: string | null;
  payload?: unknown;
  status?: number;
  path?: string;
  requestId?: string | null;
  statusCode?: number | null;
  kind?: ApiClientKind;
  category?: ApiErrorCategory;
  validationErrors?: ValidationError[];
};

type JsonRequestOptions<TRequest, TResponse> = {
  path: string;
  method?: "GET" | "POST" | "PUT";
  body?: TRequest;
  requestSchema?: ValidationSchema<TRequest>;
  requestSchemaName?: string;
  responseSchema: ValidationSchema<TResponse>;
  responseSchemaName: string;
  errorMessage: string;
  fallbackMessage?: string;
};

function toApiClientError(
  message: string,
  options: {
    cause?: unknown;
    code?: string | null;
    payload?: unknown;
    status?: number;
    path?: string;
    requestId?: string | null;
    statusCode?: number | null;
    kind?: ApiClientKind;
    category?: ApiErrorCategory;
    validationErrors?: ValidationError[];
  } = {}
): ApiClientError {
  const error = new Error(message, {
    cause: options.cause
  }) as ApiClientError;

  if (options.code !== undefined) {
    error.code = options.code;
  }

  if (options.payload !== undefined) {
    error.payload = options.payload;
  }

  if (options.status !== undefined) {
    error.status = options.status;
  }

  if (options.path !== undefined) {
    error.path = options.path;
  }

  if (options.requestId !== undefined) {
    error.requestId = options.requestId;
  }

  if (options.statusCode !== undefined) {
    error.statusCode = options.statusCode;
  }

  if (options.kind !== undefined) {
    error.kind = options.kind;
  }

  if (options.category !== undefined) {
    error.category = options.category;
  }

  if (Array.isArray(options.validationErrors)) {
    error.validationErrors = options.validationErrors;
  }

  return error;
}

function extractValidationErrors(error: unknown): ValidationError[] {
  const queue = [error];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (
      "validationErrors" in current &&
      Array.isArray((current as { validationErrors?: unknown }).validationErrors)
    ) {
      return (current as { validationErrors: ValidationError[] }).validationErrors;
    }

    if ("cause" in current) {
      queue.push((current as { cause?: unknown }).cause);
    }
  }

  return [];
}

function extractErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("code" in payload)) {
    return null;
  }

  const code = payload.code;
  return typeof code === "string" && code ? code : null;
}

function extractTransportErrorPayload(payload: unknown): TransportErrorPayload | null {
  const parsed = transportErrorPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function categorizeHttpError(statusCode: number, code: string | null): ApiErrorCategory {
  if (code === "VERSION_CONFLICT" || statusCode === 409) {
    return "version_conflict";
  }

  if (
    code === "REQUEST_VALIDATION_FAILED" ||
    code === "RESPONSE_VALIDATION_FAILED" ||
    statusCode === 422
  ) {
    return "validation";
  }

  if (code === "AUTH_REQUIRED" || statusCode === 401 || statusCode === 403) {
    return "auth";
  }

  if (statusCode >= 500) {
    return "unexpected_5xx";
  }

  return "business";
}

function shouldReportUnexpectedClientError(error: ApiClientError): boolean {
  return (
    error.category === "network" ||
    error.category === "unexpected_5xx" ||
    error.kind === "request_validation" ||
    error.kind === "response_validation"
  );
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof Error;
}

export function isAuthApiError(error: unknown): error is ApiClientError {
  return isApiClientError(error) && (error.category === "auth" || error.code === "AUTH_REQUIRED");
}

function extractRequestId(response: Response): string | null {
  const headers = response?.headers as
    | Headers
    | {
        get?(name: string): string | null | undefined;
        [key: string]: unknown;
      }
    | undefined;

  if (!headers) {
    return null;
  }

  if (typeof headers.get === "function") {
    const requestId = headers.get("x-request-id");
    return typeof requestId === "string" && requestId ? requestId : null;
  }

  const rawHeaders = headers as Record<string, unknown>;
  const rawRequestId = rawHeaders["x-request-id"] || rawHeaders["X-Request-Id"];
  return typeof rawRequestId === "string" && rawRequestId ? rawRequestId : null;
}

function reportUnexpectedClientError(
  error: ApiClientError,
  context: {
    kind: ApiClientKind;
    category: ApiErrorCategory;
    schemaName?: string;
  }
): void {
  reportFrontendException(error, {
    area: "react-shell",
    kind: context.kind,
    category: context.category,
    path: error.path,
    requestId: error.requestId,
    statusCode: error.statusCode,
    code: error.code,
    schemaName: context.schemaName || null,
    extra: error.validationErrors?.length
      ? {
          validationErrors: error.validationErrors
        }
      : undefined
  });
}

async function tryReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestJson<TRequest, TResponse>({
  path,
  method = "GET",
  body,
  requestSchema,
  requestSchemaName,
  responseSchema,
  responseSchemaName,
  errorMessage,
  fallbackMessage
}: JsonRequestOptions<TRequest, TResponse>): Promise<TResponse> {
  const resolvedFallbackMessage = fallbackMessage || errorMessage;
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  let payloadBody: string | undefined;
  if (body !== undefined) {
    try {
      const parsedBody = requestSchema
        ? parseWithSchema(requestSchema, body, {
            schemaName: requestSchemaName || "request",
            message: errorMessage
          })
        : body;
      headers["Content-Type"] = "application/json";
      payloadBody = JSON.stringify(parsedBody);
    } catch (error: unknown) {
      const requestValidationError = toApiClientError(errorMessage, {
        cause: error,
        path,
        kind: "request_validation",
        category: "validation",
        validationErrors: extractValidationErrors(error)
      });
      reportUnexpectedClientError(requestValidationError, {
        kind: "request_validation",
        category: "validation",
        schemaName: requestSchemaName || "request"
      });
      throw requestValidationError;
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers,
      ...(payloadBody ? { body: payloadBody } : {})
    });
  } catch (error: unknown) {
    const networkError = toApiClientError(resolvedFallbackMessage, {
      cause: error,
      path,
      kind: "network",
      category: "network"
    });
    reportUnexpectedClientError(networkError, {
      kind: "network",
      category: "network"
    });
    throw networkError;
  }

  const requestId = extractRequestId(response);

  if (!response.ok) {
    const payload = await tryReadJson(response);
    const transportError = extractTransportErrorPayload(payload);
    const code = extractErrorCode(payload);
    const clientError = toApiClientError(translateServerMessage(payload, errorMessage), {
      code,
      payload,
      status: response.status,
      path,
      requestId,
      statusCode: response.status,
      kind: "http",
      category: categorizeHttpError(response.status, code),
      validationErrors: transportError?.validationErrors || []
    });
    if (shouldReportUnexpectedClientError(clientError)) {
      reportUnexpectedClientError(clientError, {
        kind: "http",
        category: clientError.category || "business"
      });
    }
    throw clientError;
  }

  try {
    return await readValidatedJson(
      response,
      responseSchema,
      resolvedFallbackMessage,
      responseSchemaName
    );
  } catch (error: unknown) {
    const validationError = toApiClientError(resolvedFallbackMessage, {
      cause: error,
      status: response.status,
      path,
      requestId,
      statusCode: response.status,
      kind: "response_validation",
      category: "validation",
      validationErrors: extractValidationErrors(error)
    });
    reportUnexpectedClientError(validationError, {
      kind: "response_validation",
      category: "validation",
      schemaName: responseSchemaName
    });
    throw validationError;
  }
}
