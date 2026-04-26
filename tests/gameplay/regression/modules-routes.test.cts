const assert = require("node:assert/strict");
const {
  handleDisableModuleRoute,
  handleEnableModuleRoute,
  handleListModulesRoute,
  handleModuleOptionsRoute,
  handleRescanModulesRoute
} = require("../../../backend/routes/modules.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function createAuthContext() {
  return {
    user: {
      id: "admin-1",
      username: "marshal"
    }
  };
}

register("handleModuleOptionsRoute returns the current module options snapshot", async () => {
  let sentPayload: unknown = null;

  await handleModuleOptionsRoute(
    {},
    async () => ({
      gameModules: [{ id: "demo.valid" }]
    }),
    (_res: unknown, _statusCode: number, payload: unknown) => {
      sentPayload = payload;
    }
  );

  assert.deepEqual(sentPayload, {
    gameModules: [{ id: "demo.valid" }]
  });
});

register("handleListModulesRoute returns early when auth is missing", async () => {
  let sendJsonCalls = 0;
  let sendLocalizedErrorCalls = 0;

  await handleListModulesRoute(
    {},
    {},
    async () => null,
    () => {
      throw new Error("authorize should not run without auth.");
    },
    async () => {
      throw new Error("listInstalledModules should not run without auth.");
    },
    async () => {
      throw new Error("getEnabledModules should not run without auth.");
    },
    () => {
      sendJsonCalls += 1;
    },
    () => {
      sendLocalizedErrorCalls += 1;
    },
    "engine-1"
  );

  assert.equal(sendJsonCalls, 0);
  assert.equal(sendLocalizedErrorCalls, 0);
});

register("handleListModulesRoute maps authorization failures to localized errors", async () => {
  let localizedErrorCall: any[] | null = null;

  await handleListModulesRoute(
    {},
    {},
    async () => createAuthContext(),
    () => {
      const error = new Error("forbidden") as Error & { statusCode?: number };
      error.statusCode = 418;
      throw error;
    },
    async () => {
      throw new Error("listInstalledModules should not run after authorize fails.");
    },
    async () => {
      throw new Error("getEnabledModules should not run after authorize fails.");
    },
    () => {
      throw new Error("sendJson should not run after authorize fails.");
    },
    (...args: any[]) => {
      localizedErrorCall = args;
    },
    "engine-1"
  );

  assert.ok(localizedErrorCall);
  assert.equal(localizedErrorCall?.[1], 418);
  assert.equal(localizedErrorCall?.[3], "Accesso catalogo moduli non autorizzato.");
  assert.equal(localizedErrorCall?.[4], "server.modules.listUnauthorized");
});

register("handleEnableModuleRoute returns the refreshed module payload", async () => {
  let sentPayload: Record<string, unknown> | null = null;

  await handleEnableModuleRoute(
    {},
    {},
    "demo.valid",
    async () => createAuthContext(),
    () => undefined,
    async (moduleId: string) => [{ id: moduleId, enabled: true }],
    async () => [{ id: "demo.valid", version: "1.0.0" }],
    (_res: unknown, _statusCode: number, payload: Record<string, unknown>) => {
      sentPayload = payload;
    },
    () => {
      throw new Error("sendLocalizedError should not run for a successful enable.");
    },
    "engine-7"
  );

  assert.deepEqual(sentPayload, {
    ok: true,
    modules: [{ id: "demo.valid", enabled: true }],
    enabledModules: [{ id: "demo.valid", version: "1.0.0" }],
    engineVersion: "engine-7"
  });
});

register("handleRescanModulesRoute defaults unexpected failures to status 400", async () => {
  let localizedErrorCall: any[] | null = null;

  await handleRescanModulesRoute(
    {},
    {},
    async () => createAuthContext(),
    () => undefined,
    async () => {
      throw new Error("scan failed");
    },
    async () => [{ id: "core.base", version: "1.0.0" }],
    () => {
      throw new Error("sendJson should not run when rescan fails.");
    },
    (...args: any[]) => {
      localizedErrorCall = args;
    },
    "engine-1"
  );

  assert.ok(localizedErrorCall);
  assert.equal(localizedErrorCall?.[1], 400);
  assert.equal(localizedErrorCall?.[3], "Rescan moduli non riuscito.");
  assert.equal(localizedErrorCall?.[4], "server.modules.rescanFailed");
});

register("handleDisableModuleRoute maps active-game conflicts to a 409", async () => {
  let localizedErrorCall: any[] | null = null;

  await handleDisableModuleRoute(
    {},
    {},
    "demo.valid",
    async () => createAuthContext(),
    () => undefined,
    async () => {
      throw new Error("module still used by active game");
    },
    async () => [{ id: "core.base", version: "1.0.0" }],
    () => {
      throw new Error("sendJson should not run when disable fails.");
    },
    (...args: any[]) => {
      localizedErrorCall = args;
    },
    "engine-1"
  );

  assert.ok(localizedErrorCall);
  assert.equal(localizedErrorCall?.[1], 409);
  assert.equal(localizedErrorCall?.[3], "Il modulo e ancora usato da una partita attiva.");
  assert.equal(localizedErrorCall?.[4], "server.modules.disableInUse");
});

register("handleDisableModuleRoute maps admin-default conflicts to a 409", async () => {
  let localizedErrorCall: any[] | null = null;

  await handleDisableModuleRoute(
    {},
    {},
    "demo.valid",
    async () => createAuthContext(),
    () => undefined,
    async () => {
      throw new Error("module still used by admin defaults");
    },
    async () => [{ id: "core.base", version: "1.0.0" }],
    () => {
      throw new Error("sendJson should not run when disable fails.");
    },
    (...args: any[]) => {
      localizedErrorCall = args;
    },
    "engine-1"
  );

  assert.ok(localizedErrorCall);
  assert.equal(localizedErrorCall?.[1], 409);
  assert.equal(localizedErrorCall?.[3], "Il modulo e ancora usato dalla configurazione admin.");
  assert.equal(localizedErrorCall?.[4], "server.modules.disableAdminConfigInUse");
});
