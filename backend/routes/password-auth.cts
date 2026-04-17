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
const { loginRequestSchema, loginResponseSchema } = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError, sendValidatedJson } = require("../route-validation.cjs");

async function handleRegisterRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  auth: AuthStore,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
): Promise<void> {
  const result = await auth.registerPasswordUser({
    username: body.username,
    password: body.password,
    email: body.email
  });
  if (!result.ok) {
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

  sendJson(res, 201, {
    ok: true,
    user: result.user,
    nextAuthProviders: ["password", "email", "google", "discord"]
  });
}

async function handleLoginRoute(
  req: unknown,
  res: unknown,
  body: Record<string, any>,
  auth: AuthStore,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError,
  buildSessionCookie: BuildSessionCookie
): Promise<void> {
  const parsedBody = parseRequestOrSendError(
    res as import("node:http").ServerResponse,
    body,
    loginRequestSchema,
    sendLocalizedError as SendLocalizedError
  );
  if (!parsedBody) {
    return;
  }

  const result = await auth.loginWithPassword(parsedBody.username, parsedBody.password);
  if (!result.ok) {
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

  sendValidatedJson(
    res as import("node:http").ServerResponse,
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
