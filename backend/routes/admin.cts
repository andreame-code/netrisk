const {
  adminAuditResponseSchema,
  adminConfigResponseSchema,
  adminConfigUpdateRequestSchema,
  adminConfigUpdateResponseSchema,
  adminGameActionRequestSchema,
  adminGameActionResponseSchema,
  adminGameDetailsResponseSchema,
  adminGamesResponseSchema,
  adminMaintenanceActionRequestSchema,
  adminMaintenanceActionResponseSchema,
  adminMaintenanceReportSchema,
  adminOverviewResponseSchema,
  adminUserInviteCreateRequestSchema,
  adminUserInviteCreateResponseSchema,
  adminUserInvitesResponseSchema,
  adminUserRoleUpdateRequestSchema,
  adminUserRoleUpdateResponseSchema,
  adminUsersResponseSchema
} = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError, sendValidatedJson } = require("../route-validation.cjs");

type SendJson = (
  res: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
  headers?: Record<string, string>
) => void;

type SendLocalizedError = (
  res: import("node:http").ServerResponse,
  statusCode: number,
  input: Record<string, unknown> | null,
  fallbackMessage: string,
  fallbackKey: string | null,
  fallbackParams?: Record<string, unknown>,
  code?: string | null,
  extra?: Record<string, unknown>
) => void;

type RequireAuth = (
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
  url?: URL | null
) => Promise<{ user: { id: string; username: string; role?: string } } | null>;

type Authorize = (action: string, context: Record<string, unknown>) => unknown;

type AdminConsole = {
  getOverview(): Promise<unknown>;
  listUsers(filters?: { query?: string | null; role?: string | null }): Promise<unknown>;
  updateUserRole(
    actor: { id: string; username: string; role?: string },
    input: { userId: string; role: "admin" | "user" }
  ): Promise<unknown>;
  listUserInvites(): Promise<unknown>;
  createUserInvite(
    actor: { id: string; username: string; role?: string },
    input: { label?: string | null; email?: string | null; expiresInDays?: number | null }
  ): Promise<unknown>;
  listGames(filters?: { query?: string | null; status?: string | null }): Promise<unknown>;
  getGameDetails(gameId: string): Promise<unknown>;
  performGameAction(
    actor: { id: string; username: string; role?: string },
    input: {
      gameId: string;
      action: "close-lobby" | "terminate-game" | "repair-game-config";
      confirmation?: string | null;
    }
  ): Promise<unknown>;
  getConfig(): Promise<unknown>;
  updateConfig(
    actor: { id: string; username: string; role?: string },
    input: { defaults?: Record<string, unknown>; maintenance?: Record<string, unknown> }
  ): Promise<unknown>;
  getMaintenanceReport(): Promise<unknown>;
  runMaintenanceAction(
    actor: { id: string; username: string; role?: string },
    input: { action: "validate-all" | "cleanup-stale-lobbies"; confirmation?: string | null }
  ): Promise<unknown>;
  listAudit(): Promise<unknown>;
  recordAudit?(input: {
    actor: { id: string; username: string; role?: string };
    action: string;
    targetType: string;
    targetId?: string | null;
    targetLabel?: string | null;
    result: "success" | "failure";
    details?: Record<string, unknown> | null;
  }): Promise<unknown>;
};

async function requireAdminAccess(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  url?: URL | null
) {
  const authContext = await requireAuth(req, res, body, url);
  if (!authContext) {
    return null;
  }

  authorize("admin:manage", { user: authContext.user });
  return authContext;
}

async function tryRecordFailureAudit(
  adminConsole: AdminConsole,
  authContext: { user: { id: string; username: string; role?: string } } | null,
  action: string,
  targetType: string,
  targetId: string | null,
  targetLabel: string | null,
  error: unknown
) {
  if (!authContext || typeof adminConsole.recordAudit !== "function") {
    return;
  }

  try {
    await adminConsole.recordAudit({
      actor: authContext.user,
      action,
      targetType,
      targetId,
      targetLabel,
      result: "failure",
      details: {
        error:
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message || "")
            : "unknown"
      }
    });
  } catch {
    // Audit failures must not hide the primary route error.
  }
}

async function handleAdminOverviewRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.getOverview(),
      adminOverviewResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Accesso overview admin non autorizzato.",
      "server.admin.overviewUnauthorized"
    );
  }
}

async function handleAdminUsersRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  url: URL,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize, url);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.listUsers({
        query: url.searchParams.get("q"),
        role: url.searchParams.get("role")
      }),
      adminUsersResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Accesso utenti admin non autorizzato.",
      "server.admin.usersUnauthorized"
    );
  }
}

async function handleAdminUserRoleRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  let authContext: { user: { id: string; username: string; role?: string } } | null = null;

  try {
    authContext = await requireAdminAccess(req, res, body, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    const parsedBody = parseRequestOrSendError(
      res,
      body,
      adminUserRoleUpdateRequestSchema,
      sendLocalizedError
    );
    if (!parsedBody) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.updateUserRole(authContext.user, parsedBody),
      adminUserRoleUpdateResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      "user.role.update",
      "user",
      typeof body.userId === "string" ? body.userId : null,
      null,
      error
    );
    sendLocalizedError(
      res,
      error?.statusCode || 400,
      error,
      "Aggiornamento ruolo utente non riuscito.",
      "server.admin.userRoleUpdateFailed"
    );
  }
}

async function handleAdminUserInvitesRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.listUserInvites(),
      adminUserInvitesResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Inviti utenti admin non disponibili.",
      "server.admin.userInvitesUnavailable"
    );
  }
}

async function handleAdminUserInviteCreateRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  let authContext: { user: { id: string; username: string; role?: string } } | null = null;

  try {
    authContext = await requireAdminAccess(req, res, body, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    const parsedBody = parseRequestOrSendError(
      res,
      body,
      adminUserInviteCreateRequestSchema,
      sendLocalizedError
    );
    if (!parsedBody) {
      return;
    }

    sendValidatedJson(
      res,
      201,
      await adminConsole.createUserInvite(authContext.user, parsedBody),
      adminUserInviteCreateResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      "user.invite.create",
      "user-invite",
      null,
      null,
      error
    );
    sendLocalizedError(
      res,
      error?.statusCode || 400,
      error,
      "Creazione invito utente non riuscita.",
      "server.admin.userInviteCreateFailed"
    );
  }
}

async function handleAdminGamesRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  url: URL,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize, url);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.listGames({
        query: url.searchParams.get("q"),
        status: url.searchParams.get("status")
      }),
      adminGamesResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Accesso partite admin non autorizzato.",
      "server.admin.gamesUnauthorized"
    );
  }
}

async function handleAdminGameDetailRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  gameId: string,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.getGameDetails(gameId),
      adminGameDetailsResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 404,
      error,
      "Dettaglio partita admin non disponibile.",
      "server.admin.gameDetailUnavailable"
    );
  }
}

async function handleAdminGameActionRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  let authContext: { user: { id: string; username: string; role?: string } } | null = null;

  try {
    authContext = await requireAdminAccess(req, res, body, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    const parsedBody = parseRequestOrSendError(
      res,
      body,
      adminGameActionRequestSchema,
      sendLocalizedError
    );
    if (!parsedBody) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.performGameAction(authContext.user, parsedBody),
      adminGameActionResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      typeof body.action === "string" ? `game.${body.action}` : "game.action",
      "game",
      typeof body.gameId === "string" ? body.gameId : null,
      null,
      error
    );
    sendLocalizedError(
      res,
      error?.statusCode || 400,
      error,
      "Operazione admin sulla partita non riuscita.",
      "server.admin.gameActionFailed"
    );
  }
}

async function handleAdminConfigRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.getConfig(),
      adminConfigResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Configurazione admin non disponibile.",
      "server.admin.configUnavailable"
    );
  }
}

async function handleAdminConfigUpdateRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  let authContext: { user: { id: string; username: string; role?: string } } | null = null;

  try {
    authContext = await requireAdminAccess(req, res, body, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    const parsedBody = parseRequestOrSendError(
      res,
      body,
      adminConfigUpdateRequestSchema,
      sendLocalizedError
    );
    if (!parsedBody) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.updateConfig(authContext.user, parsedBody),
      adminConfigUpdateResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      "config.update",
      "config",
      "global",
      "Global defaults",
      error
    );
    sendLocalizedError(
      res,
      error?.statusCode || 400,
      error,
      "Aggiornamento configurazione admin non riuscito.",
      "server.admin.configUpdateFailed"
    );
  }
}

async function handleAdminMaintenanceRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.getMaintenanceReport(),
      adminMaintenanceReportSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Report manutenzione admin non disponibile.",
      "server.admin.maintenanceUnavailable"
    );
  }
}

async function handleAdminMaintenanceActionRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  let authContext: { user: { id: string; username: string; role?: string } } | null = null;

  try {
    authContext = await requireAdminAccess(req, res, body, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    const parsedBody = parseRequestOrSendError(
      res,
      body,
      adminMaintenanceActionRequestSchema,
      sendLocalizedError
    );
    if (!parsedBody) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.runMaintenanceAction(authContext.user, parsedBody),
      adminMaintenanceActionResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      typeof body.action === "string" ? `maintenance.${body.action}` : "maintenance.action",
      "maintenance",
      typeof body.action === "string" ? body.action : null,
      null,
      error
    );
    sendLocalizedError(
      res,
      error?.statusCode || 400,
      error,
      "Operazione manutenzione admin non riuscita.",
      "server.admin.maintenanceActionFailed"
    );
  }
}

async function handleAdminAuditRoute(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.listAudit(),
      adminAuditResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Audit log admin non disponibile.",
      "server.admin.auditUnavailable"
    );
  }
}

module.exports = {
  handleAdminAuditRoute,
  handleAdminConfigRoute,
  handleAdminConfigUpdateRoute,
  handleAdminGameActionRoute,
  handleAdminGameDetailRoute,
  handleAdminGamesRoute,
  handleAdminMaintenanceActionRoute,
  handleAdminMaintenanceRoute,
  handleAdminOverviewRoute,
  handleAdminUserInviteCreateRoute,
  handleAdminUserInvitesRoute,
  handleAdminUserRoleRoute,
  handleAdminUsersRoute
};
