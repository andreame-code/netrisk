import type {
  ProfileResponseContract,
  AuthSessionResponseContract
} from "../../shared/api-contracts.cjs";

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
  deps.sendJson(deps.res, 200, payload);
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
    deps.sendJson(deps.res, 200, payload);
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

  if (typeof body.theme !== "string" || !deps.supportedSiteThemes.has(body.theme)) {
    deps.sendLocalizedError(
      deps.res,
      400,
      null,
      "Tema non supportato.",
      "server.profile.invalidTheme"
    );
    return true;
  }

  const user = await deps.auth.updateUserThemePreference(authContext.user.id, body.theme);
  deps.sendJson(deps.res, 200, {
    ok: true,
    user,
    preferences: user?.preferences || { theme: deps.resolveStoredTheme(body.theme) }
  });
  return true;
}
