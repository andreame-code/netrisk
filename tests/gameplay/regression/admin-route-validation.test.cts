const assert = require("node:assert/strict");
const {
  handleAdminAuditRoute,
  handleAdminConfigRoute,
  handleAdminConfigUpdateRoute,
  handleAdminGameActionRoute,
  handleAdminGameDetailRoute,
  handleAdminGamesRoute,
  handleAdminMaintenanceActionRoute,
  handleAdminMaintenanceRoute,
  handleAdminOverviewRoute,
  handleAdminUserRoleRoute,
  handleAdminUsersRoute
} = require("../../../backend/routes/admin.cjs");
const {
  handleAdminContentStudioCreateRoute,
  handleAdminContentStudioDisableRoute,
  handleAdminContentStudioEnableRoute,
  handleAdminContentStudioModuleDetailRoute,
  handleAdminContentStudioModulesRoute,
  handleAdminContentStudioOptionsRoute,
  handleAdminContentStudioPublishRoute,
  handleAdminContentStudioUpdateRoute,
  handleAdminContentStudioValidateRoute
} = require("../../../backend/routes/admin-content-studio.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type LocalizedErrorCall = any[];

function createAuthContext() {
  return {
    user: {
      id: "admin-1",
      username: "marshal",
      role: "admin"
    }
  };
}

function requireLocalizedErrorCall(call: LocalizedErrorCall | null): LocalizedErrorCall {
  if (!call) {
    throw new Error("Expected a localized error call.");
  }
  return call;
}

function createValidDraft(id: string = "victory.route-validation") {
  return {
    id,
    name: "Route Validation Objective",
    description: "Objective used to exercise admin content studio route guards.",
    version: "1.0.0",
    moduleType: "victory-objectives",
    content: {
      mapId: "world-classic",
      objectives: [
        {
          id: "hold-na",
          title: "Hold North America",
          description: "Control North America.",
          enabled: true,
          type: "control-continents",
          continentIds: ["north_america"]
        }
      ]
    }
  };
}

register("admin routes return early when auth is missing", async () => {
  let sendJsonCalls = 0;
  let sendLocalizedErrorCalls = 0;
  let adminConsoleCalls = 0;
  let authorizeCalls = 0;

  const requireAuth = async () => null;
  const authorize = () => {
    authorizeCalls += 1;
  };
  const sendJson = () => {
    sendJsonCalls += 1;
  };
  const sendLocalizedError = () => {
    sendLocalizedErrorCalls += 1;
  };
  const adminConsole = new Proxy(
    {},
    {
      get() {
        return async () => {
          adminConsoleCalls += 1;
          throw new Error("adminConsole should not run without auth.");
        };
      }
    }
  );

  await handleAdminOverviewRoute(
    {},
    {},
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminUsersRoute(
    {},
    {},
    new URL("http://127.0.0.1/api/admin/users?q=ops&role=user"),
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminUserRoleRoute(
    {},
    {},
    { userId: "user-1", role: "admin" },
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminGamesRoute(
    {},
    {},
    new URL("http://127.0.0.1/api/admin/games?q=ops&status=lobby"),
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminGameDetailRoute(
    {},
    {},
    "game-1",
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminGameActionRoute(
    {},
    {},
    { gameId: "game-1", action: "terminate-game", confirmation: "game-1" },
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminConfigRoute(
    {},
    {},
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminConfigUpdateRoute(
    {},
    {},
    { defaults: {}, maintenance: { staleLobbyDays: 7, auditLogLimit: 50 } },
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminMaintenanceRoute(
    {},
    {},
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminMaintenanceActionRoute(
    {},
    {},
    { action: "validate-all" },
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminAuditRoute(
    {},
    {},
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );

  assert.equal(sendJsonCalls, 0);
  assert.equal(sendLocalizedErrorCalls, 0);
  assert.equal(adminConsoleCalls, 0);
  assert.equal(authorizeCalls, 0);
});

register("admin content studio routes return early when auth is missing", async () => {
  let sendJsonCalls = 0;
  let sendLocalizedErrorCalls = 0;
  let adminConsoleCalls = 0;
  let authorizeCalls = 0;

  const requireAuth = async () => null;
  const authorize = () => {
    authorizeCalls += 1;
  };
  const sendJson = () => {
    sendJsonCalls += 1;
  };
  const sendLocalizedError = () => {
    sendLocalizedErrorCalls += 1;
  };
  const adminConsole = new Proxy(
    {},
    {
      get() {
        return async () => {
          adminConsoleCalls += 1;
          throw new Error("content studio service should not run without auth.");
        };
      }
    }
  );

  await handleAdminContentStudioOptionsRoute(
    {},
    {},
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminContentStudioModulesRoute(
    {},
    {},
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminContentStudioModuleDetailRoute(
    {},
    {},
    "victory.route-validation",
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminContentStudioValidateRoute(
    {},
    {},
    createValidDraft(),
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminContentStudioCreateRoute(
    {},
    {},
    createValidDraft(),
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminContentStudioUpdateRoute(
    {},
    {},
    "victory.route-validation",
    createValidDraft(),
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminContentStudioPublishRoute(
    {},
    {},
    "victory.route-validation",
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminContentStudioEnableRoute(
    {},
    {},
    "victory.route-validation",
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );
  await handleAdminContentStudioDisableRoute(
    {},
    {},
    "victory.route-validation",
    requireAuth,
    authorize,
    adminConsole,
    sendJson,
    sendLocalizedError
  );

  assert.equal(sendJsonCalls, 0);
  assert.equal(sendLocalizedErrorCalls, 0);
  assert.equal(adminConsoleCalls, 0);
  assert.equal(authorizeCalls, 0);
});

register("handleAdminUserRoleRoute rejects invalid inbound payloads", async () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;
  let updateUserRoleCalls = 0;

  await handleAdminUserRoleRoute(
    {},
    {},
    { userId: 99, role: "owner" },
    async () => createAuthContext(),
    () => undefined,
    {
      async updateUserRole() {
        updateUserRoleCalls += 1;
        throw new Error("updateUserRole should not run for invalid payloads.");
      }
    },
    () => {
      throw new Error("sendJson should not run for invalid admin role payloads.");
    },
    (...args: LocalizedErrorCall) => {
      localizedErrorCall = args;
    }
  );

  const localizedError = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(updateUserRoleCalls, 0);
  assert.equal(localizedError[1], 400);
  assert.equal(localizedError[6], "REQUEST_VALIDATION_FAILED");
  assert.deepEqual(
    localizedError[7].validationErrors.map((entry: { path: string }) => entry.path),
    ["userId", "role"]
  );
});

register(
  "handleAdminContentStudioValidateRoute rejects invalid drafts before service calls",
  async () => {
    let localizedErrorCall: LocalizedErrorCall | null = null;
    let validateCalls = 0;

    await handleAdminContentStudioValidateRoute(
      {},
      {},
      { id: "", content: { mapId: 7, objectives: "invalid" } },
      async () => createAuthContext(),
      () => undefined,
      {
        async validateAuthoredModuleDraft() {
          validateCalls += 1;
          throw new Error("validateAuthoredModuleDraft should not run for invalid payloads.");
        }
      },
      () => {
        throw new Error("sendJson should not run for invalid content studio payloads.");
      },
      (...args: LocalizedErrorCall) => {
        localizedErrorCall = args;
      }
    );

    const localizedError = requireLocalizedErrorCall(localizedErrorCall);
    const validationPaths = localizedError[7].validationErrors.map(
      (entry: { path: string }) => entry.path
    );
    assert.equal(validateCalls, 0);
    assert.equal(localizedError[1], 400);
    assert.equal(localizedError[6], "REQUEST_VALIDATION_FAILED");
    assert.equal(validationPaths.includes("id"), true);
    assert.equal(validationPaths.includes("content.mapId"), true);
    assert.equal(validationPaths.includes("content.objectives"), true);
  }
);

register("handleAdminGameActionRoute maps failures and swallows failure audit errors", async () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;
  let performGameActionCalls = 0;
  let recordAuditCalls = 0;

  await handleAdminGameActionRoute(
    {},
    {},
    {
      gameId: "game-9",
      action: "terminate-game",
      confirmation: "game-9"
    },
    async () => createAuthContext(),
    () => undefined,
    {
      async performGameAction() {
        performGameActionCalls += 1;
        const error = new Error("stale lobby") as Error & { statusCode?: number };
        error.statusCode = 409;
        throw error;
      },
      async recordAudit() {
        recordAuditCalls += 1;
        throw new Error("audit offline");
      }
    },
    () => {
      throw new Error("sendJson should not run after a failed admin game action.");
    },
    (...args: LocalizedErrorCall) => {
      localizedErrorCall = args;
    }
  );

  assert.equal(performGameActionCalls, 1);
  assert.equal(recordAuditCalls, 1);
  const localizedError = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(localizedError[1], 409);
  assert.equal(localizedError[3], "Operazione admin sulla partita non riuscita.");
  assert.equal(localizedError[4], "server.admin.gameActionFailed");
});

register(
  "handleAdminContentStudioCreateRoute preserves validation details from failed saves",
  async () => {
    let localizedErrorCall: LocalizedErrorCall | null = null;
    let recordAuditCalls = 0;

    const validation = {
      errors: [
        {
          path: "content.objectives[0].territoryCount",
          code: "territory-count-out-of-range"
        }
      ]
    };

    await handleAdminContentStudioCreateRoute(
      {},
      {},
      createValidDraft("victory.invalid-territory-count"),
      async () => createAuthContext(),
      () => undefined,
      {
        async saveAuthoredModuleDraft() {
          const error = new Error("invalid draft") as Error & {
            statusCode?: number;
            validation?: unknown;
          };
          error.statusCode = 422;
          error.validation = validation;
          throw error;
        },
        async recordAudit() {
          recordAuditCalls += 1;
        }
      },
      () => {
        throw new Error("sendJson should not run when saving the draft fails.");
      },
      (...args: LocalizedErrorCall) => {
        localizedErrorCall = args;
      }
    );

    assert.equal(recordAuditCalls, 1);
    const localizedError = requireLocalizedErrorCall(localizedErrorCall);
    assert.equal(localizedError[1], 422);
    assert.equal(localizedError[3], "Unable to save the module draft.");
    assert.equal(localizedError[4], "server.admin.contentStudio.saveFailed");
    assert.deepEqual(localizedError[7], { validation });
  }
);

register(
  "handleAdminContentStudioPublishRoute keeps the primary error when audit persistence fails",
  async () => {
    let localizedErrorCall: LocalizedErrorCall | null = null;
    let recordAuditCalls = 0;

    await handleAdminContentStudioPublishRoute(
      {},
      {},
      "victory.publish-failure",
      async () => createAuthContext(),
      () => undefined,
      {
        async publishAuthoredModule() {
          const error = new Error("module unavailable") as Error & { statusCode?: number };
          error.statusCode = 503;
          throw error;
        },
        async recordAudit() {
          recordAuditCalls += 1;
          throw new Error("audit unavailable");
        }
      },
      () => {
        throw new Error("sendJson should not run when publishing fails.");
      },
      (...args: LocalizedErrorCall) => {
        localizedErrorCall = args;
      }
    );

    assert.equal(recordAuditCalls, 1);
    const localizedError = requireLocalizedErrorCall(localizedErrorCall);
    assert.equal(localizedError[1], 503);
    assert.equal(localizedError[3], "Unable to publish the module.");
    assert.equal(localizedError[4], "server.admin.contentStudio.publishFailed");
  }
);
