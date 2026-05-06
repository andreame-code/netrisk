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

type AuthContext = {
  user: {
    id: string;
    username: string;
  };
};

type RequireAuth = (
  req: unknown,
  res: unknown,
  body: Record<string, unknown>
) => Promise<AuthContext | null>;
type Authorize = (action: string, context: Record<string, unknown>) => unknown;
type ListInstalledModules = () => Promise<unknown>;
type GetEnabledModules = () => Promise<unknown>;
type RescanModules = () => Promise<unknown>;
type ToggleModule = (moduleId: string) => Promise<unknown>;
type GetModuleOptions = () => Promise<unknown>;

async function requireModuleAdmin(
  req: unknown,
  res: unknown,
  body: Record<string, unknown>,
  requireAuth: RequireAuth,
  authorize: Authorize
): Promise<AuthContext | null> {
  const authContext = await requireAuth(req, res, body);
  if (!authContext) {
    return null;
  }

  authorize("modules:manage", { user: authContext.user });
  return authContext;
}

async function handleListModulesRoute(
  req: unknown,
  res: unknown,
  requireAuth: RequireAuth,
  authorize: Authorize,
  listInstalledModules: ListInstalledModules,
  getEnabledModules: GetEnabledModules,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError,
  engineVersion: string
): Promise<void> {
  try {
    const authContext = await requireModuleAdmin(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendJson(res, 200, {
      modules: await listInstalledModules(),
      enabledModules: await getEnabledModules(),
      engineVersion
    });
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Accesso catalogo moduli non autorizzato.",
      "server.modules.listUnauthorized"
    );
  }
}

async function handleModuleOptionsRoute(
  res: unknown,
  getModuleOptions: GetModuleOptions,
  sendJson: SendJson
): Promise<void> {
  sendJson(res, 200, await getModuleOptions());
}

async function handleRescanModulesRoute(
  req: unknown,
  res: unknown,
  requireAuth: RequireAuth,
  authorize: Authorize,
  rescanModules: RescanModules,
  getEnabledModules: GetEnabledModules,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError,
  engineVersion: string
): Promise<void> {
  try {
    const authContext = await requireModuleAdmin(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendJson(res, 200, {
      ok: true,
      modules: await rescanModules(),
      enabledModules: await getEnabledModules(),
      engineVersion
    });
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 400,
      error,
      "Rescan moduli non riuscito.",
      "server.modules.rescanFailed"
    );
  }
}

async function handleEnableModuleRoute(
  req: unknown,
  res: unknown,
  moduleId: string,
  requireAuth: RequireAuth,
  authorize: Authorize,
  enableModule: ToggleModule,
  getEnabledModules: GetEnabledModules,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError,
  engineVersion: string
): Promise<void> {
  try {
    const authContext = await requireModuleAdmin(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendJson(res, 200, {
      ok: true,
      modules: await enableModule(moduleId),
      enabledModules: await getEnabledModules(),
      engineVersion
    });
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 400,
      error,
      "Abilitazione modulo non riuscita.",
      "server.modules.enableFailed"
    );
  }
}

async function handleDisableModuleRoute(
  req: unknown,
  res: unknown,
  moduleId: string,
  requireAuth: RequireAuth,
  authorize: Authorize,
  disableModule: ToggleModule,
  getEnabledModules: GetEnabledModules,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError,
  engineVersion: string
): Promise<void> {
  try {
    const authContext = await requireModuleAdmin(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendJson(res, 200, {
      ok: true,
      modules: await disableModule(moduleId),
      enabledModules: await getEnabledModules(),
      engineVersion
    });
  } catch (error: any) {
    const isActiveGameConflict =
      typeof error?.message === "string" && error.message.indexOf("active game") !== -1;
    const isAdminDefaultsConflict =
      typeof error?.message === "string" && error.message.indexOf("admin defaults") !== -1;
    const message = isActiveGameConflict
      ? "Il modulo e ancora usato da una partita attiva."
      : isAdminDefaultsConflict
        ? "Il modulo e ancora usato dalla configurazione admin."
        : "Disabilitazione modulo non riuscita.";
    const key = isActiveGameConflict
      ? "server.modules.disableInUse"
      : isAdminDefaultsConflict
        ? "server.modules.disableAdminConfigInUse"
        : "server.modules.disableFailed";
    const statusCode =
      isActiveGameConflict || isAdminDefaultsConflict ? 409 : error?.statusCode || 400;
    sendLocalizedError(res, statusCode, error, message, key);
  }
}

module.exports = {
  handleDisableModuleRoute,
  handleEnableModuleRoute,
  handleListModulesRoute,
  handleModuleOptionsRoute,
  handleRescanModulesRoute
};
