export type MessageParams = Record<string, unknown>;

export interface LocalizedError extends Error {
  code?: string;
  messageKey: string | null;
  messageParams: MessageParams;
}

export interface ActionFailure {
  ok: false;
  message: string;
  messageKey: string | null;
  messageParams: MessageParams;
}

export interface DomainFailure {
  ok: false;
  error: string;
  errorKey: string | null;
  errorParams: MessageParams;
}

export interface ValidationFailure {
  ok: false;
  reason: string;
  reasonKey: string | null;
  reasonParams: MessageParams;
}

export interface LogEntry {
  message: string;
  messageKey: string | null;
  messageParams: MessageParams;
}

export function createLocalizedError(
  message: string,
  messageKey: string | null,
  messageParams: MessageParams = {},
  code: string | null = null
): LocalizedError {
  const error = new Error(message) as LocalizedError;
  error.messageKey = messageKey || null;
  error.messageParams = messageParams || {};
  if (code) {
    error.code = code;
  }
  return error;
}

export function createActionFailure(
  message: string,
  messageKey: string | null,
  messageParams: MessageParams = {}
): ActionFailure {
  return {
    ok: false,
    message,
    messageKey,
    messageParams
  };
}

export function createDomainFailure(
  error: string,
  messageKey: string | null,
  messageParams: MessageParams = {}
): DomainFailure {
  return {
    ok: false,
    error,
    errorKey: messageKey,
    errorParams: messageParams
  };
}

export function createValidationFailure(
  reason: string,
  reasonKey: string | null,
  reasonParams: MessageParams = {}
): ValidationFailure {
  return {
    ok: false,
    reason,
    reasonKey,
    reasonParams
  };
}

export function createLogEntry(
  message: string,
  messageKey: string | null,
  messageParams: MessageParams = {}
): LogEntry {
  return {
    message,
    messageKey: messageKey || null,
    messageParams: messageParams || {}
  };
}
