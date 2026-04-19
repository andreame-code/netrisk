import { parseWithSchema } from "../../generated/shared-runtime-validation.mjs";
import { translateServerMessage } from "../../i18n.mjs";
import { reportFrontendException } from "../observability.mjs";
import { readValidatedJson } from "../validated-json.mjs";

type ValidationSchema<T> = {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
};

export type ApiClientError = Error & {
  code?: string | null;
  payload?: unknown;
  status?: number;
  path?: string;
  requestId?: string | null;
  statusCode?: number | null;
  kind?: "network" | "http" | "response_validation";
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
    kind?: "network" | "http" | "response_validation";
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

  return error;
}

function extractErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("code" in payload)) {
    return null;
  }

  const code = payload.code;
  return typeof code === "string" && code ? code : null;
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
    kind: "network" | "http" | "response_validation";
    schemaName?: string;
  }
): void {
  reportFrontendException(error, {
    area: "react-shell",
    kind: context.kind,
    path: error.path,
    requestId: error.requestId,
    statusCode: error.statusCode,
    code: error.code,
    schemaName: context.schemaName || null
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
    const parsedBody = requestSchema
      ? parseWithSchema(requestSchema, body, {
          schemaName: requestSchemaName || "request",
          message: errorMessage
        })
      : body;
    headers["Content-Type"] = "application/json";
    payloadBody = JSON.stringify(parsedBody);
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
      kind: "network"
    });
    reportUnexpectedClientError(networkError, {
      kind: "network"
    });
    throw networkError;
  }

  const requestId = extractRequestId(response);

  if (!response.ok) {
    const payload = await tryReadJson(response);
    const clientError = toApiClientError(translateServerMessage(payload, errorMessage), {
      code: extractErrorCode(payload),
      payload,
      status: response.status,
      path,
      requestId,
      statusCode: response.status,
      kind: "http"
    });
    if (response.status >= 500) {
      reportUnexpectedClientError(clientError, {
        kind: "http"
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
      kind: "response_validation"
    });
    reportUnexpectedClientError(validationError, {
      kind: "response_validation",
      schemaName: responseSchemaName
    });
    throw validationError;
  }
}
