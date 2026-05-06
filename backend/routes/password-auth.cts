import type * as HttpTypes from "node:http";
type SendJson = (
  res: unknown,
  statusCode: number,
  payload: unknown,
  headers?: Record<string, string>
) => void;
type SendLocalizedError = (
  res: unknown,
  statusCode: number,
  error: unknown,
  message?: string,
  messageKey?: string,
  messageParams?: Record<string, unknown>,
  code?: string,
  extraPayload?: Record<string, unknown>
) => void;

type AuthStore = {
  registerPasswordUser(input: {
    username?: string;
    password?: string;
    email?: string;
  }): Promise<any>;
  loginWithPassword(username?: string, password?: string): Promise<any>;
  logout(sessionToken: string | null): Promise<void> | void;
};

type ExtractSessionToken = (req: unknown, body?: Record<string, unknown>) => string | null;
type BuildSessionCookie = (req: unknown, sessionToken: string) => string;
type ClearSessionCookie = (req: unknown) => string;
type AuthAttemptThrottle = {
  check(key: Record<string, unknown>): { allowed: boolean; retryAfterSeconds: number };
  recordAttempt(key: Record<string, unknown>): { allowed: boolean; retryAfterSeconds: number };
  recordFailure(key: Record<string, unknown>): { allowed: boolean; retryAfterSeconds: number };
  recordSuccess(key: Record<string, unknown>): void;
};
const {
  loginRequestSchema,
  loginResponseSchema,
  registerRequestSchema
} = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError, sendValidatedJson } = require("../route-validation.cjs");
const { createAuthThrottleKey } = require("../auth-attempt-throttle.cjs");

function sendTooManyAuthAttempts(
  res: unknown,
  sendLocalizedError: SendLocalizedError,
  retryAfterSeconds: number
): void {
  sendLocalizedError(
    res,
    429,
    {
      error: "Troppi tentativi di accesso. Riprova piu tardi.",
      errorKey: "auth.throttle.tooManyAttempts",
      errorParams: { retryAfterSeconds },
      code: "AUTH_RATE_LIMITED"
    },
    "Troppi tentativi di accesso. Riprova piu tardi.",
    "auth.throttle.tooManyAttempts",
    { retryAfterSeconds },
    "AUTH_RATE_LIMITED",
    { retryAfterSeconds }
  );
}

async function handleRegisterRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  auth: AuthStore,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError,
  authAttemptThrottle?: AuthAttemptThrottle
): Promise<void> {
  const parsedBody = parseRequestOrSendError(
    res as HttpTypes.ServerResponse,
    body,
    registerRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const throttleKey = createAuthThrottleKey("register", req, parsedBody.username);
  const throttleDecision = authAttemptThrottle?.check(throttleKey);
  if (throttleDecision && !throttleDecision.allowed) {
    sendTooManyAuthAttempts(res, sendLocalizedError, throttleDecision.retryAfterSeconds);
    return;
  }

  const result = await auth.registerPasswordUser({
    username: parsedBody.username,
    password: parsedBody.password,
    email: parsedBody.email
  });
  if (!result.ok) {
    authAttemptThrottle?.recordAttempt(throttleKey);
    sendLocalizedError(
      res,
      400,
      result,
      result.error,
      result.errorKey || "register.errors.submitFailed",
      result.errorParams
    );
    return;
  }

  authAttemptThrottle?.recordAttempt(throttleKey);
  sendValidatedJson(
    res as HttpTypes.ServerResponse,
    201,
    {
      ok: true,
      user: result.user,
      nextAuthProviders: ["password", "email", "google", "discord"]
    },
    loginResponseSchema,
    sendJson as SendJson,
    sendLocalizedError as SendLocalizedError
  );
}

async function handleLoginRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  auth: AuthStore,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError,
  buildSessionCookie: BuildSessionCookie,
  authAttemptThrottle?: AuthAttemptThrottle
): Promise<void> {
  const parsedBody = parseRequestOrSendError(
    res as HttpTypes.ServerResponse,
    body,
    loginRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const throttleKey = createAuthThrottleKey("login", req, parsedBody.username);
  const throttleDecision = authAttemptThrottle?.check(throttleKey);
  if (throttleDecision && !throttleDecision.allowed) {
    sendTooManyAuthAttempts(res, sendLocalizedError, throttleDecision.retryAfterSeconds);
    return;
  }

  const result = await auth.loginWithPassword(parsedBody.username, parsedBody.password);
  if (!result.ok) {
    authAttemptThrottle?.recordFailure(throttleKey);
    sendLocalizedError(
      res,
      401,
      result,
      result.error,
      result.errorKey || "errors.loginFailed",
      result.errorParams
    );
    return;
  }

  authAttemptThrottle?.recordSuccess(throttleKey);
  sendValidatedJson(
    res as HttpTypes.ServerResponse,
    200,
    {
      ok: true,
      user: result.user,
      availableAuthProviders: ["password", "email", "google", "discord"]
    },
    loginResponseSchema,
    sendJson as SendJson,
    sendLocalizedError as SendLocalizedError,
    {
      "Set-Cookie": buildSessionCookie(req, result.sessionToken)
    }
  );
}

async function handleLogoutRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  auth: AuthStore,
  sendJson: SendJson,
  extractSessionToken: ExtractSessionToken,
  clearSessionCookie: ClearSessionCookie
): Promise<void> {
  await auth.logout(extractSessionToken(req, body));
  sendJson(
    res,
    200,
    { ok: true },
    {
      "Set-Cookie": clearSessionCookie(req)
    }
  );
}

module.exports = {
  handleLoginRoute,
  handleLogoutRoute,
  handleRegisterRoute
};
