import { parseWithSchema } from "../../generated/shared-runtime-validation.mjs";
import { translateServerMessage } from "../../i18n.mjs";
import { readValidatedJson } from "../validated-json.mjs";

type ValidationSchema<T> = {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
};

export type ApiClientError = Error & {
  code?: string | null;
  payload?: unknown;
  status?: number;
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

  return error;
}

function extractErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("code" in payload)) {
    return null;
  }

  const code = payload.code;
  return typeof code === "string" && code ? code : null;
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

  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    ...(payloadBody ? { body: payloadBody } : {})
  });

  if (!response.ok) {
    const payload = await tryReadJson(response);
    throw toApiClientError(translateServerMessage(payload, errorMessage), {
      code: extractErrorCode(payload),
      payload,
      status: response.status
    });
  }

  try {
    return await readValidatedJson(
      response,
      responseSchema,
      resolvedFallbackMessage,
      responseSchemaName
    );
  } catch (error: unknown) {
    throw toApiClientError(resolvedFallbackMessage, {
      cause: error
    });
  }
}
