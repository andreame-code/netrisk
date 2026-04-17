import type {
  ProfileResponseContract,
  AuthSessionResponseContract
} from "../../shared/api-contracts.cjs";
const {
  authSessionResponseSchema,
  profileResponseSchema,
  themePreferenceRequestSchema,
  themePreferenceResponseSchema
} = require("../../shared/runtime-validation.cjs");
const {
  parseRequestOrSendError,
  sendValidatedJson
} = require("../route-validation.cjs");

type RequireAuthFn = (
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>
) => Promise<{ user: { id: string; username: string } } | null>;

interface AccountRouteDeps {
  req: import("node:http").IncomingMessage;
  res: import("node:http").ServerResponse;
  requireAuth: RequireAuthFn;
  auth: {
    publicUser(user: unknown): unknown;
    updateUserThemePreference(
      userId: string,
      theme: string
    ): Promise<{ preferences?: { theme?: string | null } } | null>;
  };
  playerProfiles: {
    getPlayerProfile(username: string): Promise<Record<string, unknown>> | Record<string, unknown>;
  };
  sendJson: (
    res: import("node:http").ServerResponse,
    statusCode: number,
    payload: unknown,
    headers?: Record<string, string>
  ) => void;
  sendLocalizedError: (
    res: import("node:http").ServerResponse,
    statusCode: number,
    input: Record<string, unknown> | null,
    fallbackMessage: string,
    fallbackKey: string | null,
    fallbackParams?: Record<string, unknown>,
    code?: string | null,
    extra?: Record<string, unknown>
  ) => void;
  extractUserPreferences: (user: unknown) => Record<string, unknown>;
  supportedSiteThemes: Set<string>;
  resolveStoredTheme: (theme: string) => string;
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

  if (!deps.supportedSiteThemes.has(parsedBody.theme)) {
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
  sendValidatedJson(deps.res, 200, {
    ok: true,
    user,
    preferences: user?.preferences || { theme: deps.resolveStoredTheme(parsedBody.theme) }
  }, themePreferenceResponseSchema, deps.sendJson, deps.sendLocalizedError);
  return true;
}
