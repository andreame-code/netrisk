import type * as HttpTypes from "node:http";
import type {
  AccountSettingsUpdateResponseContract,
  ProfileResponseContract,
  AuthSessionResponseContract
} from "../../shared/api-contracts.cjs";
const {
  accountSettingsRequestSchema,
  accountSettingsResponseSchema,
  authSessionResponseSchema,
  profileResponseSchema,
  themePreferenceRequestSchema,
  themePreferenceResponseSchema
} = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError, sendValidatedJson } = require("../route-validation.cjs");

type RequireAuthFn = (
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
  body: Record<string, unknown>
) => Promise<{ user: { id: string; username: string } } | null>;

type SupportedSiteThemesSource = Set<string> | (() => Promise<Set<string>> | Set<string>);

interface AccountRouteDeps {
  req: HttpTypes.IncomingMessage;
  res: HttpTypes.ServerResponse;
  requireAuth: RequireAuthFn;
  auth: {
    publicUser(user: unknown): unknown;
    updateUserAccountSettings(input: Record<string, unknown>): Promise<{
      ok: boolean;
      user?: unknown;
      error?: string;
      errorKey?: string;
      errorParams?: Record<string, unknown>;
    }>;
    updateUserThemePreference(
      userId: string,
      theme: string
    ): Promise<{ preferences?: { theme?: string | null } } | null>;
  };
  authAttemptThrottle?: {
    check(key: Record<string, unknown>): { allowed: boolean; retryAfterSeconds: number };
    recordFailure(key: Record<string, unknown>): { allowed: boolean; retryAfterSeconds: number };
    recordSuccess(key: Record<string, unknown>): void;
  };
  playerProfiles: {
    getPlayerProfile(username: string): Promise<Record<string, unknown>> | Record<string, unknown>;
  };
  sendJson: (
    res: HttpTypes.ServerResponse,
    statusCode: number,
    payload: unknown,
    headers?: Record<string, string>
  ) => void;
  sendLocalizedError: (
    res: HttpTypes.ServerResponse,
    statusCode: number,
    input: Record<string, unknown> | null,
    fallbackMessage: string,
    fallbackKey: string | null,
    fallbackParams?: Record<string, unknown>,
    code?: string | null,
    extra?: Record<string, unknown>
  ) => void;
  extractUserPreferences: (user: unknown) => Record<string, unknown>;
  supportedSiteThemes: SupportedSiteThemesSource;
  resolveStoredTheme: (theme: string) => string;
}

const { createAuthThrottleKey } = require("../auth-attempt-throttle.cjs");

async function resolveRouteSupportedSiteThemes(deps: AccountRouteDeps): Promise<Set<string>> {
  return typeof deps.supportedSiteThemes === "function"
    ? await deps.supportedSiteThemes()
    : deps.supportedSiteThemes;
}

export async function handleAuthSessionRoute(deps: AccountRouteDeps): Promise<boolean> {
  const authContext = await deps.requireAuth(deps.req, deps.res, {});
  if (!authContext) {
    return true;
  }

  const payload: AuthSessionResponseContract = {
    user: deps.auth.publicUser(authContext.user) as AuthSessionResponseContract["user"]
  };
  sendValidatedJson(
    deps.res,
    200,
    payload,
    authSessionResponseSchema,
    deps.sendJson,
    deps.sendLocalizedError
  );
  return true;
}

export async function handleProfileRoute(deps: AccountRouteDeps): Promise<boolean> {
  const authContext = await deps.requireAuth(deps.req, deps.res, {});
  if (!authContext) {
    return true;
  }

  try {
    const payload: ProfileResponseContract = {
      profile: {
        ...(await deps.playerProfiles.getPlayerProfile(authContext.user.username)),
        preferences: deps.extractUserPreferences(authContext.user)
      } as unknown as ProfileResponseContract["profile"]
    };
    sendValidatedJson(
      deps.res,
      200,
      payload,
      profileResponseSchema,
      deps.sendJson,
      deps.sendLocalizedError
    );
  } catch (error) {
    deps.sendLocalizedError(
      deps.res,
      400,
      error as Record<string, unknown>,
      "Profilo non disponibile.",
      "server.profile.unavailable"
    );
  }

  return true;
}

export async function handleThemePreferenceRoute(
  deps: AccountRouteDeps,
  body: Record<string, unknown>
): Promise<boolean> {
  const authContext = await deps.requireAuth(deps.req, deps.res, body);
  if (!authContext) {
    return true;
  }

  const parsedBody = parseRequestOrSendError(
    deps.res,
    body,
    themePreferenceRequestSchema,
    deps.sendLocalizedError
  );
  if (!parsedBody) {
    return true;
  }

  const supportedSiteThemes = await resolveRouteSupportedSiteThemes(deps);
  if (!supportedSiteThemes.has(parsedBody.theme)) {
    deps.sendLocalizedError(
      deps.res,
      400,
      null,
      "Tema non supportato.",
      "server.profile.invalidTheme"
    );
    return true;
  }

  const user = await deps.auth.updateUserThemePreference(authContext.user.id, parsedBody.theme);
  sendValidatedJson(
    deps.res,
    200,
    {
      ok: true,
      user,
      preferences: user?.preferences || { theme: deps.resolveStoredTheme(parsedBody.theme) }
    },
    themePreferenceResponseSchema,
    deps.sendJson,
    deps.sendLocalizedError
  );
  return true;
}

export async function handleAccountSettingsRoute(
  deps: AccountRouteDeps,
  body: Record<string, unknown>
): Promise<boolean> {
  const authContext = await deps.requireAuth(deps.req, deps.res, body);
  if (!authContext) {
    return true;
  }

  const parsedBody = parseRequestOrSendError(
    deps.res,
    body,
    accountSettingsRequestSchema,
    deps.sendLocalizedError
  );
  if (!parsedBody) {
    return true;
  }

  const throttleKey = createAuthThrottleKey("account", deps.req, authContext.user.username);
  const throttleDecision = deps.authAttemptThrottle?.check(throttleKey);
  if (throttleDecision && !throttleDecision.allowed) {
    deps.sendLocalizedError(
      deps.res,
      429,
      {
        error: "Troppi tentativi di verifica password. Riprova piu tardi.",
        errorKey: "auth.throttle.tooManyAttempts",
        errorParams: { retryAfterSeconds: throttleDecision.retryAfterSeconds },
        code: "AUTH_RATE_LIMITED"
      },
      "Troppi tentativi di verifica password. Riprova piu tardi.",
      "auth.throttle.tooManyAttempts",
      { retryAfterSeconds: throttleDecision.retryAfterSeconds },
      "AUTH_RATE_LIMITED",
      { retryAfterSeconds: throttleDecision.retryAfterSeconds }
    );
    return true;
  }

  const result = await deps.auth.updateUserAccountSettings({
    userId: authContext.user.id,
    currentPassword: parsedBody.currentPassword,
    ...(parsedBody.email ? { email: parsedBody.email } : {}),
    ...(parsedBody.newPassword ? { newPassword: parsedBody.newPassword } : {}),
    ...(parsedBody.confirmNewPassword ? { confirmNewPassword: parsedBody.confirmNewPassword } : {})
  });

  if (!result.ok || !result.user) {
    if (result.errorKey === "auth.account.currentPasswordInvalid") {
      deps.authAttemptThrottle?.recordFailure(throttleKey);
    }
    deps.sendLocalizedError(
      deps.res,
      result.errorKey === "auth.account.currentPasswordInvalid" ? 401 : 400,
      result as Record<string, unknown>,
      result.error || "Aggiornamento account non riuscito.",
      result.errorKey || "profile.account.status.saveFailed",
      result.errorParams
    );
    return true;
  }

  deps.authAttemptThrottle?.recordSuccess(throttleKey);
  const payload: AccountSettingsUpdateResponseContract = {
    ok: true,
    user: result.user as AccountSettingsUpdateResponseContract["user"]
  };
  sendValidatedJson(
    deps.res,
    200,
    payload,
    accountSettingsResponseSchema,
    deps.sendJson,
    deps.sendLocalizedError
  );
  return true;
}
