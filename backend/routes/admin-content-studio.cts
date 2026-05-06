import type * as HttpTypes from "node:http";
const {
  adminAuthoredModuleDetailResponseSchema,
  adminAuthoredModuleEditorOptionsResponseSchema,
  adminAuthoredModuleMutationResponseSchema,
  adminAuthoredModulesListResponseSchema,
  adminAuthoredModuleUpsertRequestSchema,
  adminAuthoredModuleValidateResponseSchema
} = require("../../shared/runtime-validation.cjs");
const { parseRequestOrSendError, sendValidatedJson } = require("../route-validation.cjs");

type SendJson = (
  res: HttpTypes.ServerResponse,
  statusCode: number,
  payload: unknown,
  headers?: Record<string, string>
) => void;

type SendLocalizedError = (
  res: HttpTypes.ServerResponse,
  statusCode: number,
  input: Record<string, unknown> | null,
  fallbackMessage: string,
  fallbackKey: string | null,
  fallbackParams?: Record<string, unknown>,
  code?: string | null,
  extra?: Record<string, unknown>
) => void;

type RequireAuth = (
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
  body: Record<string, unknown>,
  url?: URL | null
) => Promise<{ user: { id: string; username: string; role?: string } } | null>;

type Authorize = (action: string, context: Record<string, unknown>) => unknown;

type AdminConsole = {
  getAuthoredModuleEditorOptions(): Promise<unknown>;
  listAuthoredModules(): Promise<unknown>;
  getAuthoredModule(moduleId: string): Promise<unknown>;
  validateAuthoredModuleDraft(input: Record<string, unknown>): Promise<unknown>;
  saveAuthoredModuleDraft(
    actor: { id: string; username: string; role?: string },
    input: Record<string, unknown>
  ): Promise<unknown>;
  publishAuthoredModule(
    actor: { id: string; username: string; role?: string },
    moduleId: string
  ): Promise<unknown>;
  enableAuthoredModule(
    actor: { id: string; username: string; role?: string },
    moduleId: string
  ): Promise<unknown>;
  disableAuthoredModule(
    actor: { id: string; username: string; role?: string },
    moduleId: string
  ): Promise<unknown>;
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
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
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
  targetId: string | null,
  error: unknown
) {
  if (!authContext || typeof adminConsole.recordAudit !== "function") {
    return;
  }

  try {
    await adminConsole.recordAudit({
      actor: authContext.user,
      action,
      targetType: "authored-module",
      targetId,
      targetLabel: null,
      result: "failure",
      details: {
        error:
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message || "")
            : "unknown"
      }
    });
  } catch {
    // Audit persistence must not hide the primary failure.
  }
}

function sendAuthoredModuleError(
  res: HttpTypes.ServerResponse,
  sendLocalizedError: SendLocalizedError,
  error: unknown,
  fallbackMessage: string,
  fallbackKey: string
) {
  const validation =
    error && typeof error === "object" && "validation" in error
      ? ((error as { validation?: unknown }).validation ?? null)
      : null;

  sendLocalizedError(
    res,
    error && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode || 400)
      : 400,
    error as Record<string, unknown> | null,
    fallbackMessage,
    fallbackKey,
    {},
    null,
    validation ? { validation } : {}
  );
}

function ensureModuleIdMatchesPath(routeModuleId: string, bodyModuleId: string) {
  if (routeModuleId.trim() !== bodyModuleId) {
    throw new Error(
      `Request body module id "${bodyModuleId}" does not match route id "${routeModuleId}".`
    );
  }
}

async function handleAdminContentStudioOptionsRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
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
      await adminConsole.getAuthoredModuleEditorOptions(),
      adminAuthoredModuleEditorOptionsResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Content Studio options are unavailable.",
      "server.admin.contentStudio.optionsUnavailable"
    );
  }
}

async function handleAdminContentStudioModulesRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
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
      await adminConsole.listAuthoredModules(),
      adminAuthoredModulesListResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 403,
      error,
      "Content Studio modules are unavailable.",
      "server.admin.contentStudio.modulesUnavailable"
    );
  }
}

async function handleAdminContentStudioModuleDetailRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
  moduleId: string,
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
      await adminConsole.getAuthoredModule(moduleId),
      adminAuthoredModuleDetailResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendLocalizedError(
      res,
      error?.statusCode || 404,
      error,
      "Content Studio module not available.",
      "server.admin.contentStudio.moduleUnavailable"
    );
  }
}

async function handleAdminContentStudioValidateRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
  body: Record<string, unknown>,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  try {
    const authContext = await requireAdminAccess(req, res, body, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    const parsedBody = parseRequestOrSendError(
      res,
      body,
      adminAuthoredModuleUpsertRequestSchema,
      sendLocalizedError
    );
    if (!parsedBody) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.validateAuthoredModuleDraft(parsedBody),
      adminAuthoredModuleValidateResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    sendAuthoredModuleError(
      res,
      sendLocalizedError,
      error,
      "Module validation failed.",
      "server.admin.contentStudio.validationFailed"
    );
  }
}

async function handleAdminContentStudioCreateRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
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
      adminAuthoredModuleUpsertRequestSchema,
      sendLocalizedError
    );
    if (!parsedBody) {
      return;
    }

    sendValidatedJson(
      res,
      201,
      await adminConsole.saveAuthoredModuleDraft(authContext.user, parsedBody),
      adminAuthoredModuleMutationResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      "content-studio.module.save-draft",
      typeof body.id === "string" ? body.id : null,
      error
    );
    sendAuthoredModuleError(
      res,
      sendLocalizedError,
      error,
      "Unable to save the module draft.",
      "server.admin.contentStudio.saveFailed"
    );
  }
}

async function handleAdminContentStudioUpdateRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
  moduleId: string,
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
      adminAuthoredModuleUpsertRequestSchema,
      sendLocalizedError
    );
    if (!parsedBody) {
      return;
    }

    ensureModuleIdMatchesPath(moduleId, parsedBody.id);

    sendValidatedJson(
      res,
      200,
      await adminConsole.saveAuthoredModuleDraft(authContext.user, parsedBody),
      adminAuthoredModuleMutationResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      "content-studio.module.save-draft",
      moduleId,
      error
    );
    sendAuthoredModuleError(
      res,
      sendLocalizedError,
      error,
      "Unable to update the module draft.",
      "server.admin.contentStudio.updateFailed"
    );
  }
}

async function handleAdminContentStudioPublishRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
  moduleId: string,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  let authContext: { user: { id: string; username: string; role?: string } } | null = null;

  try {
    authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.publishAuthoredModule(authContext.user, moduleId),
      adminAuthoredModuleMutationResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      "content-studio.module.publish",
      moduleId,
      error
    );
    sendAuthoredModuleError(
      res,
      sendLocalizedError,
      error,
      "Unable to publish the module.",
      "server.admin.contentStudio.publishFailed"
    );
  }
}

async function handleAdminContentStudioEnableRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
  moduleId: string,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  let authContext: { user: { id: string; username: string; role?: string } } | null = null;

  try {
    authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.enableAuthoredModule(authContext.user, moduleId),
      adminAuthoredModuleMutationResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      "content-studio.module.enable",
      moduleId,
      error
    );
    sendAuthoredModuleError(
      res,
      sendLocalizedError,
      error,
      "Unable to enable the module.",
      "server.admin.contentStudio.enableFailed"
    );
  }
}

async function handleAdminContentStudioDisableRoute(
  req: HttpTypes.IncomingMessage,
  res: HttpTypes.ServerResponse,
  moduleId: string,
  requireAuth: RequireAuth,
  authorize: Authorize,
  adminConsole: AdminConsole,
  sendJson: SendJson,
  sendLocalizedError: SendLocalizedError
) {
  let authContext: { user: { id: string; username: string; role?: string } } | null = null;

  try {
    authContext = await requireAdminAccess(req, res, {}, requireAuth, authorize);
    if (!authContext) {
      return;
    }

    sendValidatedJson(
      res,
      200,
      await adminConsole.disableAuthoredModule(authContext.user, moduleId),
      adminAuthoredModuleMutationResponseSchema,
      sendJson,
      sendLocalizedError
    );
  } catch (error: any) {
    await tryRecordFailureAudit(
      adminConsole,
      authContext,
      "content-studio.module.disable",
      moduleId,
      error
    );
    sendAuthoredModuleError(
      res,
      sendLocalizedError,
      error,
      "Unable to disable the module.",
      "server.admin.contentStudio.disableFailed"
    );
  }
}

module.exports = {
  handleAdminContentStudioCreateRoute,
  handleAdminContentStudioModuleDetailRoute,
  handleAdminContentStudioDisableRoute,
  handleAdminContentStudioEnableRoute,
  handleAdminContentStudioModulesRoute,
  handleAdminContentStudioOptionsRoute,
  handleAdminContentStudioPublishRoute,
  handleAdminContentStudioUpdateRoute,
  handleAdminContentStudioValidateRoute
};
