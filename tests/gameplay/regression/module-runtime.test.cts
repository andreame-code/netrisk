const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("../../../backend/server.cjs");
const {
  listCoreBaseMapSummaries,
  listCoreBaseNewGameRuleSets
} = require("../../../shared/core-base-catalog.cjs");

type HeaderMap = Record<string, string>;

type MockResponse = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number, nextHeaders?: HeaderMap): void;
  end(chunk?: string): void;
};

type CallAppResult = {
  statusCode: number;
  payload: any;
};

type CallRequestResult = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
};

function register(name: string, fn: () => unknown | Promise<unknown>) {
  (
    global as typeof globalThis & {
      register?: (name: string, fn: () => unknown | Promise<unknown>) => void;
    }
  ).register?.(name, fn);
}

function makeMockResponse(): MockResponse {
  const headers: HeaderMap = {};
  return {
    statusCode: 200,
    headers,
    body: "",
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    writeHead(statusCode: number, nextHeaders: HeaderMap = {}) {
      this.statusCode = statusCode;
      Object.assign(headers, nextHeaders);
    },
    end(chunk = "") {
      this.body += chunk || "";
    }
  };
}

async function callApp(
  app: any,
  method: string,
  pathname: string,
  body?: any,
  headers: HeaderMap = {}
): Promise<CallAppResult> {
  const req = new (require("events").EventEmitter)();
  req.method = method;
  req.headers = { "content-type": "application/json", ...headers };
  req.destroy = () => {};
  const res = makeMockResponse();
  const promise = app.handleApi(req, res, new URL(`http://127.0.0.1${pathname}`));

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit("data", JSON.stringify(body));
    }
    req.emit("end");
  });

  await promise;
  return {
    statusCode: res.statusCode,
    payload: res.body ? JSON.parse(res.body) : null
  };
}

async function callRequest(
  app: any,
  method: string,
  pathname: string,
  headers: HeaderMap = {}
): Promise<CallRequestResult> {
  const req = new (require("events").EventEmitter)();
  req.method = method;
  req.url = pathname;
  req.headers = { host: "127.0.0.1", ...headers };
  req.destroy = () => {};

  const res = makeMockResponse();

  await new Promise<void>((resolve) => {
    const originalEnd = res.end.bind(res);
    res.end = (chunk = "") => {
      originalEnd(chunk);
      resolve();
    };
    app.handleRequest(req, res);
  });

  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body
  };
}

function authHeaders(sessionToken: string): HeaderMap {
  return {
    cookie: `netrisk_session=${encodeURIComponent(sessionToken)}`
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function cleanupSqliteFiles(baseFile: string): void {
  [baseFile, `${baseFile}-shm`, `${baseFile}-wal`].forEach((target) => {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  });
}

async function withModuleServer(
  modules: Array<{
    dir: string;
    manifest?: unknown;
    clientManifest?: unknown;
    rawManifest?: string;
    serverEntryPath?: string;
    serverEntrySource?: string;
  }>,
  run: (context: { app: any; adminSessionToken: string; tempRoot: string }) => Promise<void>
): Promise<void> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-modules-"));
  const dataDir = path.join(tempRoot, "data");
  const frontendDir = path.join(tempRoot, "frontend", "src");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(frontendDir, { recursive: true });

  modules.forEach((moduleEntry) => {
    const moduleRoot = path.join(tempRoot, "modules", moduleEntry.dir);
    fs.mkdirSync(moduleRoot, { recursive: true });
    if (typeof moduleEntry.rawManifest === "string") {
      fs.writeFileSync(path.join(moduleRoot, "module.json"), moduleEntry.rawManifest);
      return;
    }

    if (typeof moduleEntry.manifest !== "undefined") {
      writeJson(path.join(moduleRoot, "module.json"), moduleEntry.manifest);
    }

    if (typeof moduleEntry.clientManifest !== "undefined") {
      writeJson(path.join(moduleRoot, "client-manifest.json"), moduleEntry.clientManifest);
    }

    if (moduleEntry.serverEntryPath && typeof moduleEntry.serverEntrySource === "string") {
      const serverEntryFilePath = path.join(moduleRoot, moduleEntry.serverEntryPath);
      fs.mkdirSync(path.dirname(serverEntryFilePath), { recursive: true });
      fs.writeFileSync(serverEntryFilePath, moduleEntry.serverEntrySource);
    }
  });

  const originalProjectRoot = process.env.NETRISK_PROJECT_ROOT;
  process.env.NETRISK_PROJECT_ROOT = tempRoot;

  const tempDbFile = path.join(tempRoot, "data", "modules.sqlite");
  const tempUsersFile = path.join(tempRoot, "data", "users.json");
  const tempGamesFile = path.join(tempRoot, "data", "games.json");
  const tempSessionsFile = path.join(tempRoot, "data", "sessions.json");
  const app = createApp({
    projectRoot: tempRoot,
    dbFile: tempDbFile,
    dataFile: tempUsersFile,
    gamesFile: tempGamesFile,
    sessionsFile: tempSessionsFile
  });

  try {
    const registered = await app.auth.registerPasswordUser("module_admin", "secret123");
    assert.equal(registered.ok, true);
    await app.datastore.updateUserRoleByUsername("module_admin", "admin");
    const login = await app.auth.loginWithPassword("module_admin", "secret123");
    assert.equal(login.ok, true);

    await run({
      app,
      adminSessionToken: login.sessionToken,
      tempRoot
    });
  } finally {
    app.datastore.close();
    cleanupSqliteFiles(tempDbFile);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (typeof originalProjectRoot === "undefined") {
      delete process.env.NETRISK_PROJECT_ROOT;
    } else {
      process.env.NETRISK_PROJECT_ROOT = originalProjectRoot;
    }
  }
}

register(
  "module runtime scandisce moduli validi e invalidi ed espone catalogo e opzioni",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.valid",
          manifest: {
            schemaVersion: 1,
            id: "demo.valid",
            version: "1.0.0",
            displayName: "Demo Valid",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              { kind: "ui-slot", scope: "global", description: "Demo slot" },
              {
                kind: "gameplay-hook",
                scope: "game",
                hook: "setup.profile",
                description: "Demo profile"
              }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json"
            }
          },
          clientManifest: {
            ui: {
              slots: [
                {
                  slotId: "new-game.sidebar",
                  itemId: "demo.valid.briefing",
                  title: "Demo Briefing",
                  kind: "panel",
                  order: 10
                }
              ]
            },
            profiles: {
              gameplay: [
                {
                  id: "demo.valid.gameplay",
                  name: "Demo Gameplay"
                }
              ],
              ui: [
                {
                  id: "demo.valid.ui",
                  name: "Demo UI"
                }
              ]
            }
          }
        },
        {
          dir: "broken.module",
          rawManifest: "{ this is not valid json"
        }
      ],
      async ({ app, adminSessionToken }) => {
        const catalogResponse = await callApp(
          app,
          "GET",
          "/api/modules",
          undefined,
          authHeaders(adminSessionToken)
        );
        assert.equal(catalogResponse.statusCode, 200);
        const modules = catalogResponse.payload.modules;
        assert.equal(Array.isArray(modules), true);
        assert.equal(
          modules.some((entry: any) => entry.id === "core.base" && entry.enabled),
          true
        );
        assert.equal(
          modules.some((entry: any) => entry.id === "demo.valid" && entry.status === "validated"),
          true
        );
        assert.equal(
          modules.some((entry: any) => entry.id === "broken.module" && entry.status === "error"),
          true
        );

        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.valid/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);
        assert.equal(
          enableResponse.payload.enabledModules.some((entry: any) => entry.id === "demo.valid"),
          true
        );

        const optionsResponse = await callApp(app, "GET", "/api/modules/options");
        assert.equal(optionsResponse.statusCode, 200);
        assert.equal(
          optionsResponse.payload.gameModules.some((entry: any) => entry.id === "demo.valid"),
          true
        );
        assert.equal(
          optionsResponse.payload.uiSlots.some(
            (entry: any) => entry.itemId === "demo.valid.briefing"
          ),
          true
        );
        assert.equal(
          optionsResponse.payload.gameplayProfiles.some(
            (entry: any) => entry.id === "demo.valid.gameplay"
          ),
          true
        );

        assert.equal(Boolean(optionsResponse.payload.resolvedCatalog), true);
        assert.equal(
          optionsResponse.payload.resolvedCatalog.uiSlots.some(
            (entry: any) => entry.itemId === "demo.valid.briefing"
          ),
          true
        );
        assert.equal(
          optionsResponse.payload.resolvedCatalog.gameModules.some(
            (entry: any) => entry.id === "demo.valid"
          ),
          true
        );

        const gameOptionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(gameOptionsResponse.statusCode, 200);
        assert.equal(Array.isArray(gameOptionsResponse.payload.victoryRuleSets), true);
        assert.equal(Array.isArray(gameOptionsResponse.payload.themes), true);
        assert.equal(Array.isArray(gameOptionsResponse.payload.pieceSkins), true);
        assert.equal(Boolean(gameOptionsResponse.payload.resolvedCatalog), true);
        assert.equal(
          gameOptionsResponse.payload.resolvedCatalog.uiSlots.some(
            (entry: any) => entry.itemId === "demo.valid.briefing"
          ),
          true
        );
        assert.equal(
          gameOptionsResponse.payload.resolvedCatalog.modules.some(
            (entry: any) => entry.id === "demo.valid"
          ),
          true
        );
        assert.equal(
          gameOptionsResponse.payload.resolvedCatalog.modules.some(
            (entry: any) => entry.id === "demo.invalid"
          ),
          false
        );
      }
    );
  }
);

register(
  "module runtime espone maps e built-in new-game rule sets dal catalogo shared core.base",
  async () => {
    await withModuleServer([], async ({ app }) => {
      const gameOptionsResponse = await callApp(app, "GET", "/api/game/options");
      assert.equal(gameOptionsResponse.statusCode, 200);
      assert.deepEqual(
        gameOptionsResponse.payload.maps.map((entry: { id: string }) => entry.id),
        listCoreBaseMapSummaries().map((entry: { id: string }) => entry.id)
      );
      assert.deepEqual(
        gameOptionsResponse.payload.ruleSets.map((entry: { id: string }) => entry.id),
        listCoreBaseNewGameRuleSets().map((entry: { id: string }) => entry.id)
      );
      assert.deepEqual(
        gameOptionsResponse.payload.resolvedCatalog.maps.map((entry: { id: string }) => entry.id),
        listCoreBaseMapSummaries().map((entry: { id: string }) => entry.id)
      );
    });
  }
);

register(
  "module runtime isola capability kinds non supportati senza rompere gli endpoint options",
  async () => {
    await withModuleServer(
      [
        {
          dir: "unsupported.capability",
          manifest: {
            schemaVersion: 1,
            id: "unsupported.capability",
            version: "1.0.0",
            displayName: "Unsupported Capability",
            engineVersion: "1.0.0",
            kind: "hybrid",
            capabilities: [{ kind: "totally-new-capability", scope: "game" }]
          }
        }
      ],
      async ({ app, adminSessionToken }) => {
        const catalogResponse = await callApp(
          app,
          "GET",
          "/api/modules",
          undefined,
          authHeaders(adminSessionToken)
        );
        assert.equal(catalogResponse.statusCode, 200);
        const unsupportedModule = catalogResponse.payload.modules.find(
          (entry: any) => entry.id === "unsupported.capability"
        );
        assert.equal(Boolean(unsupportedModule), true);
        assert.equal(unsupportedModule.status, "error");

        const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
        assert.equal(moduleOptionsResponse.statusCode, 200);
        assert.equal(
          moduleOptionsResponse.payload.gameModules.some(
            (entry: any) => entry.id === "unsupported.capability"
          ),
          false
        );
        assert.equal(
          moduleOptionsResponse.payload.resolvedCatalog.gameModules.some(
            (entry: any) => entry.id === "unsupported.capability"
          ),
          false
        );

        const gameOptionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(gameOptionsResponse.statusCode, 200);
        assert.equal(Boolean(gameOptionsResponse.payload.resolvedCatalog), true);
        assert.equal(
          gameOptionsResponse.payload.resolvedCatalog.gameModules.some(
            (entry: any) => entry.id === "unsupported.capability"
          ),
          false
        );
      }
    );
  }
);

register(
  "module runtime mantiene il contratto top-level di /api/game/options per i consumer legacy/new-game",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.contract",
          manifest: {
            schemaVersion: 1,
            id: "demo.contract",
            version: "1.0.0",
            displayName: "Demo Contract",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "gameplay-hook",
                scope: "game",
                hook: "setup.profile",
                description: "Contract gameplay profile"
              }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json"
            }
          },
          clientManifest: {
            gamePresets: [
              {
                id: "demo.contract.preset",
                name: "Contract Preset",
                activeModuleIds: ["demo.contract"],
                contentProfileId: "demo.contract.content",
                gameplayProfileId: "demo.contract.gameplay",
                uiProfileId: "demo.contract.ui"
              }
            ],
            profiles: {
              content: [{ id: "demo.contract.content", name: "Contract Content" }],
              gameplay: [{ id: "demo.contract.gameplay", name: "Contract Gameplay" }],
              ui: [{ id: "demo.contract.ui", name: "Contract UI" }]
            }
          }
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.contract/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);

        const gameOptionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(gameOptionsResponse.statusCode, 200);
        assert.equal(Boolean(gameOptionsResponse.payload.resolvedCatalog), true);

        assert.equal(
          gameOptionsResponse.payload.gamePresets.some(
            (entry: any) => entry.id === "demo.contract.preset"
          ),
          true
        );
        assert.equal(
          gameOptionsResponse.payload.contentProfiles.some(
            (entry: any) => entry.id === "demo.contract.content"
          ),
          true
        );
        assert.equal(
          gameOptionsResponse.payload.gameplayProfiles.some(
            (entry: any) => entry.id === "demo.contract.gameplay"
          ),
          true
        );
        assert.equal(
          gameOptionsResponse.payload.uiProfiles.some(
            (entry: any) => entry.id === "demo.contract.ui"
          ),
          true
        );

        const topLevelModules =
          gameOptionsResponse.payload.gameModules ?? gameOptionsResponse.payload.modules;
        assert.equal(Array.isArray(topLevelModules), true);
        assert.equal(
          topLevelModules.some((entry: any) => entry.id === "demo.contract"),
          true
        );
        assert.equal(
          gameOptionsResponse.payload.resolvedCatalog.gameModules.some(
            (entry: any) => entry.id === "demo.contract"
          ),
          true
        );
      }
    );
  }
);

register("module runtime non espone slot UI con slotId non supportati", async () => {
  await withModuleServer(
    [
      {
        dir: "unsupported.slot",
        manifest: {
          schemaVersion: 1,
          id: "unsupported.slot",
          version: "1.0.0",
          displayName: "Unsupported Slot",
          engineVersion: "1.0.0",
          kind: "ui",
          capabilities: [{ kind: "ui-slot", scope: "global", description: "Unsupported slot" }],
          entrypoints: {
            clientManifest: "client-manifest.json"
          }
        },
        clientManifest: {
          ui: {
            slots: [
              {
                slotId: "unsupported.slot-id",
                itemId: "unsupported.slot.item",
                title: "Unsupported Slot",
                kind: "panel"
              }
            ]
          }
        }
      }
    ],
    async ({ app, adminSessionToken }) => {
      const catalogResponse = await callApp(
        app,
        "GET",
        "/api/modules",
        undefined,
        authHeaders(adminSessionToken)
      );
      assert.equal(catalogResponse.statusCode, 200);
      const unsupportedModule = catalogResponse.payload.modules.find(
        (entry: any) => entry.id === "unsupported.slot"
      );
      assert.equal(Boolean(unsupportedModule), true);
      assert.equal(
        unsupportedModule.errors.some((entry: string) =>
          entry.includes("Invalid UI slot contribution")
        ),
        true
      );

      const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
      assert.equal(moduleOptionsResponse.statusCode, 200);
      assert.equal(
        moduleOptionsResponse.payload.uiSlots.some(
          (entry: any) => entry.itemId === "unsupported.slot.item"
        ),
        false
      );
      assert.equal(Boolean(moduleOptionsResponse.payload.resolvedCatalog), true);
      assert.equal(
        moduleOptionsResponse.payload.resolvedCatalog.uiSlots.some(
          (entry: any) => entry.itemId === "unsupported.slot.item"
        ),
        false
      );
    }
  );
});

register(
  "module runtime rifiuta client manifest che escono dalla directory del modulo",
  async () => {
    await withModuleServer(
      [
        {
          dir: "escape.client-manifest",
          manifest: {
            schemaVersion: 1,
            id: "escape.client-manifest",
            version: "1.0.0",
            displayName: "Escape Client Manifest",
            engineVersion: "1.0.0",
            kind: "ui",
            capabilities: [],
            entrypoints: {
              clientManifest: "../../stolen.json"
            }
          }
        }
      ],
      async ({ app, adminSessionToken }) => {
        const catalogResponse = await callApp(
          app,
          "GET",
          "/api/modules",
          undefined,
          authHeaders(adminSessionToken)
        );
        assert.equal(catalogResponse.statusCode, 200);

        const escapedModule = catalogResponse.payload.modules.find(
          (entry: any) => entry.id === "escape.client-manifest"
        );
        assert.equal(Boolean(escapedModule), true);
        assert.equal(escapedModule.status, "incompatible");
        assert.equal(
          escapedModule.errors.some((entry: string) =>
            entry.includes('Client manifest "../../stolen.json" escapes the module directory.')
          ),
          true
        );
      }
    );
  }
);

register("module runtime serve gli asset modulo dal projectRoot runtime", async () => {
  await withModuleServer(
    [
      {
        dir: "demo.runtime-assets",
        manifest: {
          schemaVersion: 1,
          id: "demo.runtime-assets",
          version: "1.0.0",
          displayName: "Runtime Assets",
          engineVersion: "1.0.0",
          kind: "ui",
          capabilities: []
        },
        serverEntryPath: "assets/runtime-only.css",
        serverEntrySource: ".runtime-only { color: red; }"
      }
    ],
    async ({ app }) => {
      const staticResponse = await callRequest(
        app,
        "GET",
        "/modules/demo.runtime-assets/assets/runtime-only.css"
      );
      assert.equal(staticResponse.statusCode, 200);
      assert.equal(staticResponse.headers["Content-Type"], "text/css; charset=utf-8");
      assert.match(staticResponse.body, /runtime-only/);
    }
  );
});

register(
  "module runtime pinna activeModules nelle nuove partite e blocca il disable se il modulo e in uso",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.locked",
          manifest: {
            schemaVersion: 1,
            id: "demo.locked",
            version: "1.0.0",
            displayName: "Demo Locked",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "gameplay-hook",
                scope: "game",
                hook: "setup.profile",
                description: "Locked gameplay profile"
              }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json"
            }
          },
          clientManifest: {
            profiles: {
              content: [{ id: "demo.locked.content", name: "Locked Content" }],
              gameplay: [{ id: "demo.locked.gameplay", name: "Locked Gameplay" }],
              ui: [{ id: "demo.locked.ui", name: "Locked UI" }]
            }
          }
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.locked/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Modular Game",
            activeModuleIds: ["demo.locked"],
            contentProfileId: "demo.locked.content",
            gameplayProfileId: "demo.locked.gameplay",
            uiProfileId: "demo.locked.ui"
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(createGameResponse.statusCode, 201);
        assert.equal(createGameResponse.payload.state.gameConfig.moduleSchemaVersion, 1);
        assert.equal(
          createGameResponse.payload.state.gameConfig.activeModules.some(
            (entry: any) => entry.id === "core.base"
          ),
          true
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.activeModules.some(
            (entry: any) => entry.id === "demo.locked"
          ),
          true
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.contentProfileId,
          "demo.locked.content"
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayProfileId,
          "demo.locked.gameplay"
        );
        assert.equal(createGameResponse.payload.state.gameConfig.uiProfileId, "demo.locked.ui");

        const gameListResponse = await callApp(app, "GET", "/api/games");
        assert.equal(gameListResponse.statusCode, 200);
        const listedGame = gameListResponse.payload.games.find(
          (entry: any) => entry.id === createGameResponse.payload.game.id
        );
        assert.equal(Boolean(listedGame), true);
        assert.equal(
          listedGame.activeModules.some((entry: any) => entry.id === "demo.locked"),
          true
        );
        assert.equal(listedGame.contentProfileId, "demo.locked.content");
        assert.equal(listedGame.gameplayProfileId, "demo.locked.gameplay");
        assert.equal(listedGame.uiProfileId, "demo.locked.ui");

        const disableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.locked/disable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(disableResponse.statusCode, 409);
      }
    );
  }
);

register("module runtime protegge il catalogo admin da accessi non autorizzati", async () => {
  await withModuleServer([], async ({ app }) => {
    const anonymousResponse = await callApp(app, "GET", "/api/modules");
    assert.equal(anonymousResponse.statusCode, 401);

    const registered = await app.auth.registerPasswordUser("module_user", "secret123");
    assert.equal(registered.ok, true);
    const login = await app.auth.loginWithPassword("module_user", "secret123");
    assert.equal(login.ok, true);

    const nonAdminResponse = await callApp(
      app,
      "GET",
      "/api/modules",
      undefined,
      authHeaders(login.sessionToken)
    );
    assert.equal(nonAdminResponse.statusCode, 403);
  });
});

register(
  "module runtime filtra il catalogo setup e blocca contenuti non esposti dai moduli attivi",
  async () => {
    await withModuleServer(
      [
        {
          dir: "core.base",
          manifest: {
            schemaVersion: 1,
            id: "core.base",
            version: "1.0.0",
            displayName: "Core Restricted",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [],
            conflicts: [],
            capabilities: [
              { kind: "map", scope: "game", description: "Restricted core maps" },
              { kind: "site-theme", scope: "global", description: "Restricted core themes" }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json"
            }
          },
          clientManifest: {
            content: {
              mapIds: ["classic-mini"],
              siteThemeIds: ["command"],
              pieceSkinIds: ["classic-color"],
              playerPieceSetIds: ["classic"],
              contentPackIds: ["core"],
              diceRuleSetIds: ["standard"],
              cardRuleSetIds: ["standard"],
              victoryRuleSetIds: ["conquest"],
              fortifyRuleSetIds: ["standard"],
              reinforcementRuleSetIds: ["standard"]
            },
            profiles: {
              content: [{ id: "core.classic-content", name: "Classic Content" }],
              gameplay: [{ id: "core.standard-gameplay", name: "Standard Gameplay" }],
              ui: [{ id: "core.command-ui", name: "Command UI" }]
            }
          }
        }
      ],
      async ({ app, adminSessionToken }) => {
        const optionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(optionsResponse.statusCode, 200);
        assert.deepEqual(
          optionsResponse.payload.maps.map((entry: any) => entry.id),
          ["classic-mini"]
        );
        assert.deepEqual(
          optionsResponse.payload.diceRuleSets.map((entry: any) => entry.id),
          ["standard"]
        );
        assert.deepEqual(
          optionsResponse.payload.resolvedCatalog.ruleSets.map((entry: any) => entry.id),
          ["classic", "classic-defense-3"]
        );
        assert.deepEqual(
          optionsResponse.payload.ruleSets.map((entry: any) => entry.id),
          optionsResponse.payload.resolvedCatalog.ruleSets.map((entry: any) => entry.id)
        );
        assert.deepEqual(
          optionsResponse.payload.victoryRuleSets.map((entry: any) => entry.id),
          ["conquest"]
        );
        assert.deepEqual(
          optionsResponse.payload.themes.map((entry: any) => entry.id),
          ["command"]
        );
        assert.deepEqual(
          optionsResponse.payload.pieceSkins.map((entry: any) => entry.id),
          ["classic-color"]
        );
        assert.deepEqual(
          optionsResponse.payload.playerPieceSets.map((entry: any) => entry.id),
          ["classic"]
        );
        assert.deepEqual(
          optionsResponse.payload.contentPacks.map((entry: any) => entry.id),
          ["core"]
        );

        const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
        assert.equal(moduleOptionsResponse.statusCode, 200);
        assert.deepEqual(moduleOptionsResponse.payload.content.mapIds, ["classic-mini"]);
        assert.deepEqual(moduleOptionsResponse.payload.content.siteThemeIds, ["command"]);
        assert.deepEqual(
          moduleOptionsResponse.payload.resolvedCatalog.ruleSets.map((entry: any) => entry.id),
          ["classic", "classic-defense-3"]
        );

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Restricted Catalog Override",
            ruleSetId: "classic-defense-3",
            diceRuleSetId: "standard",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );
        assert.equal(createGameResponse.statusCode, 201);
        assert.equal(createGameResponse.payload.state.gameConfig.ruleSetId, "classic-defense-3");
        assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "standard");

        const invalidCreateResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Restricted Catalog Game",
            mapId: "world-classic"
          },
          authHeaders(adminSessionToken)
        );
        assert.equal(invalidCreateResponse.statusCode, 400);
        assert.equal(
          String(
            invalidCreateResponse.payload.error || invalidCreateResponse.payload.message
          ).includes("Selected map"),
          true
        );
      }
    );
  }
);

register(
  "module runtime applica defaults setup dai profili server-side del modulo selezionato",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.defaults",
          manifest: {
            schemaVersion: 1,
            id: "demo.defaults",
            version: "1.0.0",
            displayName: "Demo Defaults",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "gameplay-hook",
                scope: "game",
                hook: "setup.profile",
                description: "Setup defaults profile"
              }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json",
              server: "server-module.cjs"
            }
          },
          clientManifest: {
            gamePresets: [
              {
                id: "demo.defaults.command-preset",
                name: "Defaults Preset",
                activeModuleIds: ["demo.defaults"],
                contentProfileId: "demo.defaults.content",
                gameplayProfileId: "demo.defaults.gameplay",
                uiProfileId: "demo.defaults.ui",
                defaults: {
                  mapId: "classic-mini",
                  themeId: "command"
                }
              }
            ],
            profiles: {
              content: [{ id: "demo.defaults.content", name: "Defaults Content" }],
              gameplay: [{ id: "demo.defaults.gameplay", name: "Defaults Gameplay" }],
              ui: [{ id: "demo.defaults.ui", name: "Defaults UI" }]
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  profiles: {
    content: [
      { id: "demo.defaults.content", defaults: { mapId: "world-classic" } }
    ],
    gameplay: [
      {
        id: "demo.defaults.gameplay",
        defaults: { ruleSetId: "classic-defense-3", diceRuleSetId: "defense-3", victoryRuleSetId: "majority-control" },
        gameplayEffects: {
          attackMinimumArmies: 3,
          attackLimitPerTurn: 2,
          minimumAttacksPerTurn: 1,
          majorityControlThresholdPercent: 60,
          conquestMinimumArmies: 2,
          fortifyMinimumArmies: 2,
          requiredFortifyWhenAvailable: true,
          reinforcementAdjustments: [
            {
              id: "demo.defaults.supply-lines",
              label: "Supply lines",
              flatBonus: 5,
              minimumTotal: 8
            }
          ]
        },
        scenarioSetup: {
          territoryBonuses: [{ territoryId: "aurora", armies: 1 }],
          logMessage: "Scenario defaults applied."
        }
      }
    ],
    ui: [
      { id: "demo.defaults.ui", defaults: { themeId: "ember", pieceSkinId: "command-ring" } }
    ]
  }
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.defaults/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Profile Defaults Game",
            activeModuleIds: ["demo.defaults"],
            contentProfileId: "demo.defaults.content",
            gameplayProfileId: "demo.defaults.gameplay",
            uiProfileId: "demo.defaults.ui",
            turnTimeoutHours: 24
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(createGameResponse.statusCode, 201);
        assert.equal(createGameResponse.payload.state.gameConfig.mapId, "world-classic");
        assert.equal(createGameResponse.payload.state.gameConfig.ruleSetId, "classic-defense-3");
        assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
        assert.equal(
          createGameResponse.payload.state.gameConfig.victoryRuleSetId,
          "majority-control"
        );
        assert.equal(createGameResponse.payload.state.gameConfig.themeId, "ember");
        assert.equal(createGameResponse.payload.state.gameConfig.pieceSkinId, "command-ring");
        assert.equal(createGameResponse.payload.state.gameConfig.turnTimeoutHours, 24);
        assert.equal(
          createGameResponse.payload.state.gameConfig.scenarioSetup.territoryBonuses[0].territoryId,
          "aurora"
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.scenarioSetup.logMessage,
          "Scenario defaults applied."
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects.attackMinimumArmies,
          3
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects.attackLimitPerTurn,
          2
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects.minimumAttacksPerTurn,
          1
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects
            .majorityControlThresholdPercent,
          60
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects.conquestMinimumArmies,
          2
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects.fortifyMinimumArmies,
          2
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects.requiredFortifyWhenAvailable,
          true
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects.reinforcementAdjustments[0]
            .flatBonus,
          5
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayEffects.reinforcementAdjustments[0]
            .minimumTotal,
          8
        );

        const openGameResponse = await callApp(
          app,
          "POST",
          "/api/games/open",
          {
            gameId: createGameResponse.payload.game.id
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(openGameResponse.statusCode, 200);
        assert.equal(openGameResponse.payload.state.gameConfig.turnTimeoutHours, 24);
        assert.equal(
          openGameResponse.payload.state.gameConfig.scenarioSetup.territoryBonuses[0].territoryId,
          "aurora"
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.scenarioSetup.logMessage,
          "Scenario defaults applied."
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.attackMinimumArmies,
          3
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.attackLimitPerTurn,
          2
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.minimumAttacksPerTurn,
          1
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.majorityControlThresholdPercent,
          60
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.conquestMinimumArmies,
          2
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.fortifyMinimumArmies,
          2
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.requiredFortifyWhenAvailable,
          true
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.reinforcementAdjustments[0]
            .flatBonus,
          5
        );
        assert.equal(
          openGameResponse.payload.state.gameConfig.gameplayEffects.reinforcementAdjustments[0]
            .minimumTotal,
          8
        );

        const explicitOverrideResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Profile Defaults Override",
            activeModuleIds: ["demo.defaults"],
            contentProfileId: "demo.defaults.content",
            gameplayProfileId: "demo.defaults.gameplay",
            uiProfileId: "demo.defaults.ui",
            mapId: "classic-mini",
            themeId: "command",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(explicitOverrideResponse.statusCode, 201);
        assert.equal(explicitOverrideResponse.payload.state.gameConfig.mapId, "classic-mini");
        assert.equal(explicitOverrideResponse.payload.state.gameConfig.themeId, "command");
        assert.equal(explicitOverrideResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
        assert.equal(
          explicitOverrideResponse.payload.state.gameConfig.scenarioSetup.logMessage,
          "Scenario defaults applied."
        );
        assert.equal(
          explicitOverrideResponse.payload.state.gameConfig.gameplayEffects
            .reinforcementAdjustments[0].label,
          "Supply lines"
        );

        const secondRegistered = await app.auth.registerPasswordUser("module_guest", "secret123");
        assert.equal(secondRegistered.ok, true);
        const secondLogin = await app.auth.loginWithPassword("module_guest", "secret123");
        assert.equal(secondLogin.ok, true);

        const joinResponse = await callApp(
          app,
          "POST",
          "/api/join",
          {
            gameId: explicitOverrideResponse.payload.game.id
          },
          authHeaders(secondLogin.sessionToken)
        );

        assert.equal(joinResponse.statusCode, 201);
        assert.equal(joinResponse.payload.state.players.length, 2);

        const startResponse = await callApp(
          app,
          "POST",
          "/api/start",
          {
            gameId: explicitOverrideResponse.payload.game.id,
            playerId: explicitOverrideResponse.payload.playerId
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(startResponse.statusCode, 200);
        assert.equal(startResponse.payload.state.reinforcementPool >= 8, true);
        assert.equal(
          startResponse.payload.state.map.some(
            (entry: any) => entry.id === "aurora" && entry.armies === 2
          ),
          true
        );
      }
    );
  }
);

register(
  "module runtime espone mappe locali dal server module e le usa davvero in creazione partita",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.maps",
          manifest: {
            schemaVersion: 1,
            id: "demo.maps",
            version: "1.0.0",
            displayName: "Demo Maps",
            engineVersion: "1.0.0",
            kind: "content",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [{ kind: "map", scope: "game", description: "Runtime module maps" }],
            entrypoints: {
              clientManifest: "client-manifest.json",
              server: "server-module.cjs"
            }
          },
          clientManifest: {
            profiles: {
              content: [{ id: "demo.maps.content", name: "Demo Maps Content" }]
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  maps: [
    {
      id: "demo-outpost",
      name: "Demo Outpost",
      territoryRecords: [
        { id: "outpost-north", name: "Outpost North", continentId: "outpost", x: 0.2, y: 0.2, neighbors: ["outpost-south", "frontier-west"] },
        { id: "outpost-south", name: "Outpost South", continentId: "outpost", x: 0.2, y: 0.7, neighbors: ["outpost-north", "frontier-east"] },
        { id: "frontier-west", name: "Frontier West", continentId: "frontier", x: 0.7, y: 0.25, neighbors: ["outpost-north", "frontier-east"] },
        { id: "frontier-east", name: "Frontier East", continentId: "frontier", x: 0.75, y: 0.7, neighbors: ["outpost-south", "frontier-west"] }
      ],
      continentRecords: [
        { id: "outpost", name: "Outpost", bonus: 2, territoryIds: ["outpost-north", "outpost-south"] },
        { id: "frontier", name: "Frontier", bonus: 3, territoryIds: ["frontier-west", "frontier-east"] }
      ]
    }
  ],
  profiles: {
    content: [
      { id: "demo.maps.content", defaults: { mapId: "demo-outpost" } }
    ]
  }
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.maps/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);

        const optionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(optionsResponse.statusCode, 200);
        assert.equal(
          optionsResponse.payload.maps.some(
            (entry: any) => entry.id === "demo-outpost" && entry.territoryCount === 4
          ),
          true
        );

        const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
        assert.equal(moduleOptionsResponse.statusCode, 200);
        assert.equal(moduleOptionsResponse.payload.content.mapIds.includes("demo-outpost"), true);

        const missingModuleSelectionResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Missing Module Map",
            mapId: "demo-outpost",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );
        assert.equal(missingModuleSelectionResponse.statusCode, 400);
        assert.equal(
          String(
            missingModuleSelectionResponse.payload.error ||
              missingModuleSelectionResponse.payload.message
          ).includes("Selected map"),
          true
        );

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Runtime Module Map",
            activeModuleIds: ["demo.maps"],
            mapId: "demo-outpost",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(createGameResponse.statusCode, 201);
        assert.equal(createGameResponse.payload.state.gameConfig.mapId, "demo-outpost");
        assert.equal(createGameResponse.payload.state.gameConfig.mapName, "Demo Outpost");
        assert.equal(
          createGameResponse.payload.state.gameConfig.activeModules.some(
            (entry: any) => entry.id === "demo.maps"
          ),
          true
        );
        assert.equal(createGameResponse.payload.state.map.length, 4);
        assert.equal(
          createGameResponse.payload.state.map.some((entry: any) => entry.id === "outpost-north"),
          true
        );
      }
    );
  }
);

register(
  "module runtime espone temi locali e token UI come contributi modulari indipendenti",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.themes",
          manifest: {
            schemaVersion: 1,
            id: "demo.themes",
            version: "1.0.0",
            displayName: "Demo Themes",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              { kind: "site-theme", scope: "global", description: "Runtime module themes" },
              { kind: "content-pack", scope: "game", description: "Theme content pack" }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json",
              server: "server-module.cjs"
            }
          },
          clientManifest: {
            ui: {
              themeTokens: ['html[data-theme="demo-aurora"] { --accent: #77ffee; }']
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "demo-aurora",
      name: "Demo Aurora",
      description: "Runtime theme supplied by a module."
    }
  ],
  contentPacks: [
    {
      id: "demo-theme-pack",
      name: "Demo Theme Pack",
      description: "Runtime content pack with a module theme default.",
      defaultSiteThemeId: "demo-aurora",
      defaultMapId: "classic-mini",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ],
  profiles: {
    ui: [
      { id: "demo.themes.ui", defaults: { themeId: "demo-aurora" } }
    ]
  }
};`
        },
        {
          dir: "demo.stale-theme-manifest",
          manifest: {
            schemaVersion: 1,
            id: "demo.stale-theme-manifest",
            version: "1.0.0",
            displayName: "Demo Stale Theme Manifest",
            engineVersion: "1.0.0",
            kind: "content",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Manifest-only stale theme id"
              }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json"
            }
          },
          clientManifest: {
            content: {
              siteThemeIds: ["ghost-theme"]
            }
          }
        },
        {
          dir: "demo.duplicate-theme",
          manifest: {
            schemaVersion: 1,
            id: "demo.duplicate-theme",
            version: "1.0.0",
            displayName: "Demo Duplicate Theme",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Malformed duplicate theme definitions"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "duplicate-theme",
      name: "Duplicate Theme",
      description: "First duplicate theme definition."
    },
    {
      id: "duplicate-theme",
      name: "Duplicate Theme Override",
      description: "Second duplicate theme definition."
    }
  ]
};`
        },
        {
          dir: "demo.theme-provider",
          manifest: {
            schemaVersion: 1,
            id: "demo.theme-provider",
            version: "1.0.0",
            displayName: "Demo Theme Provider",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Provider theme kept disabled"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "provider-theme",
      name: "Provider Theme",
      description: "Theme owned by another module."
    }
  ]
};`
        },
        {
          dir: "demo.cross-theme-pack",
          manifest: {
            schemaVersion: 1,
            id: "demo.cross-theme-pack",
            version: "1.0.0",
            displayName: "Demo Cross Theme Pack",
            engineVersion: "1.0.0",
            kind: "content",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "content-pack",
                scope: "game",
                description: "Invalid cross-module content pack"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  contentPacks: [
    {
      id: "cross-theme-pack",
      name: "Cross Theme Pack",
      description: "References a theme from a disabled non-dependency module.",
      defaultSiteThemeId: "provider-theme",
      defaultMapId: "classic-mini",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.themes/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);
        const staleEnableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.stale-theme-manifest/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(staleEnableResponse.statusCode, 200);
        const crossThemePackEnableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.cross-theme-pack/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(crossThemePackEnableResponse.statusCode, 400);
        assert.equal(
          String(
            crossThemePackEnableResponse.payload.error ||
              crossThemePackEnableResponse.payload.message
          ).includes("provider-theme"),
          true
        );

        const optionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(optionsResponse.statusCode, 200);
        assert.equal(
          optionsResponse.payload.themes.some(
            (entry: any) => entry.id === "demo-aurora" && entry.name === "Demo Aurora"
          ),
          true
        );

        const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
        assert.equal(moduleOptionsResponse.statusCode, 200);
        assert.equal(
          moduleOptionsResponse.payload.content.siteThemeIds.includes("demo-aurora"),
          true
        );
        assert.equal(
          moduleOptionsResponse.payload.content.siteThemeIds.includes("ghost-theme"),
          true
        );
        assert.equal(
          moduleOptionsResponse.payload.themes.some((entry: any) => entry.id === "demo-aurora"),
          true
        );
        assert.equal(
          moduleOptionsResponse.payload.themes.some((entry: any) => entry.id === "ghost-theme"),
          false
        );
        const duplicateThemeModule = moduleOptionsResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.duplicate-theme"
        );
        assert.equal(duplicateThemeModule.status, "incompatible");
        assert.equal(
          duplicateThemeModule.errors.some((entry: string) =>
            entry.includes('Duplicate runtime module site theme "duplicate-theme"')
          ),
          true
        );
        assert.equal(
          moduleOptionsResponse.payload.modules
            .find((entry: any) => entry.id === "demo.themes")
            .clientManifest.ui.themeTokens[0].includes("demo-aurora"),
          true
        );

        const missingModuleSelectionResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Missing Theme Module",
            themeId: "demo-aurora",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );
        assert.equal(missingModuleSelectionResponse.statusCode, 400);
        assert.equal(
          String(
            missingModuleSelectionResponse.payload.error ||
              missingModuleSelectionResponse.payload.message
          ).includes("Selected theme"),
          true
        );

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Runtime Theme",
            activeModuleIds: ["demo.themes"],
            contentPackId: "demo-theme-pack",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );
        assert.equal(createGameResponse.statusCode, 201);
        assert.equal(createGameResponse.payload.state.gameConfig.themeId, "demo-aurora");
        assert.equal(createGameResponse.payload.state.gameConfig.contentPackId, "demo-theme-pack");

        const stalePreferenceResponse = await callApp(
          app,
          "PUT",
          "/api/profile/preferences/theme",
          { theme: "ghost-theme" },
          authHeaders(adminSessionToken)
        );
        assert.equal(stalePreferenceResponse.statusCode, 400);

        const preferenceResponse = await callApp(
          app,
          "PUT",
          "/api/profile/preferences/theme",
          { theme: "demo-aurora" },
          authHeaders(adminSessionToken)
        );
        assert.equal(preferenceResponse.statusCode, 200);
        assert.equal(preferenceResponse.payload.preferences.theme, "demo-aurora");

        const profileResponse = await callApp(
          app,
          "GET",
          "/api/profile",
          undefined,
          authHeaders(adminSessionToken)
        );
        assert.equal(profileResponse.statusCode, 200);
        assert.equal(profileResponse.payload.profile.preferences.theme, "demo-aurora");
      }
    );
  }
);

register(
  "module runtime revalida content pack contro temi di dipendenze diventate incompatibili",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.aaa-theme-consumer",
          manifest: {
            schemaVersion: 1,
            id: "demo.aaa-theme-consumer",
            version: "1.0.0",
            displayName: "Demo Theme Consumer",
            engineVersion: "1.0.0",
            kind: "content",
            dependencies: [
              { id: "core.base", version: "1.x" },
              { id: "demo.zzz-theme-provider", version: "1.x" }
            ],
            conflicts: [],
            capabilities: [
              {
                kind: "content-pack",
                scope: "game",
                description: "Depends on a provider theme"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  contentPacks: [
    {
      id: "dependent-theme-pack",
      name: "Dependent Theme Pack",
      description: "References a provider theme that later becomes unavailable.",
      defaultSiteThemeId: "late-provider-theme",
      defaultMapId: "classic-mini",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
        },
        {
          dir: "demo.zzz-theme-provider",
          manifest: {
            schemaVersion: 1,
            id: "demo.zzz-theme-provider",
            version: "1.0.0",
            displayName: "Demo Late Theme Provider",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Theme provider with invalid content defaults"
              },
              {
                kind: "content-pack",
                scope: "game",
                description: "Invalid provider content pack"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "late-provider-theme",
      name: "Late Provider Theme",
      description: "Theme from a provider that becomes incompatible."
    }
  ],
  contentPacks: [
    {
      id: "broken-provider-pack",
      name: "Broken Provider Pack",
      description: "Invalidates the provider after dependency checks have started.",
      defaultSiteThemeId: "late-provider-theme",
      defaultMapId: "missing-map",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        await app.datastore.setAppState("moduleCatalogState", {
          enabledById: {
            "core.base": true,
            "demo.aaa-theme-consumer": true,
            "demo.zzz-theme-provider": true
          },
          updatedAt: "2026-04-26T00:00:00.000Z"
        });

        const moduleOptionsResponse = await callApp(
          app,
          "GET",
          "/api/modules/options",
          undefined,
          authHeaders(adminSessionToken)
        );
        assert.equal(moduleOptionsResponse.statusCode, 200);

        const providerModule = moduleOptionsResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.zzz-theme-provider"
        );
        assert.equal(providerModule.status, "incompatible");
        assert.equal(
          providerModule.errors.some((entry: string) => entry.includes("missing-map")),
          true
        );

        const consumerModule = moduleOptionsResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.aaa-theme-consumer"
        );
        assert.equal(consumerModule.status, "incompatible");
        assert.equal(
          consumerModule.errors.some((entry: string) => entry.includes("late-provider-theme")),
          true
        );
        assert.equal(
          moduleOptionsResponse.payload.content.contentPackIds.includes("dependent-theme-pack"),
          false
        );
      }
    );
  }
);

register(
  "module runtime non lascia a moduli incompatibili la prenotazione dei temi runtime",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.aaa-broken-theme-owner",
          manifest: {
            schemaVersion: 1,
            id: "demo.aaa-broken-theme-owner",
            version: "1.0.0",
            displayName: "Demo Broken Theme Owner",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [
              { id: "core.base", version: "1.x" },
              { id: "demo.missing-theme-dependency", version: "1.x" }
            ],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Theme from an incompatible module"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "shared-runtime-theme",
      name: "Broken Shared Runtime Theme",
      description: "This theme must not reserve the id."
    }
  ]
};`
        },
        {
          dir: "demo.valid-theme-owner",
          manifest: {
            schemaVersion: 1,
            id: "demo.valid-theme-owner",
            version: "1.0.0",
            displayName: "Demo Valid Theme Owner",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Valid owner of the shared theme id"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "shared-runtime-theme",
      name: "Valid Shared Runtime Theme",
      description: "This module should own the theme id."
    }
  ]
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.valid-theme-owner/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);

        const brokenModule = enableResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.aaa-broken-theme-owner"
        );
        assert.equal(brokenModule.status, "incompatible");
        assert.equal(
          brokenModule.errors.some((entry: string) =>
            entry.includes('Missing dependency "demo.missing-theme-dependency"')
          ),
          true
        );

        const validModule = enableResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.valid-theme-owner"
        );
        assert.equal(validModule.status, "enabled");
        assert.equal(validModule.errors.length, 0);

        const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
        assert.equal(moduleOptionsResponse.statusCode, 200);
        assert.equal(
          moduleOptionsResponse.payload.themes.some(
            (entry: any) =>
              entry.id === "shared-runtime-theme" && entry.name === "Valid Shared Runtime Theme"
          ),
          true
        );
      }
    );
  }
);

register("module runtime rilascia temi quando content pack invalida il modulo", async () => {
  await withModuleServer(
    [
      {
        dir: "demo.aaa-content-broken-theme-owner",
        manifest: {
          schemaVersion: 1,
          id: "demo.aaa-content-broken-theme-owner",
          version: "1.0.0",
          displayName: "Demo Content Broken Theme Owner",
          engineVersion: "1.0.0",
          kind: "hybrid",
          dependencies: [{ id: "core.base", version: "1.x" }],
          conflicts: [],
          capabilities: [
            {
              kind: "site-theme",
              scope: "global",
              description: "Theme from a module invalidated by content defaults"
            },
            {
              kind: "content-pack",
              scope: "game",
              description: "Invalid content pack that should invalidate the module"
            }
          ],
          entrypoints: {
            server: "server-module.cjs"
          }
        },
        serverEntryPath: "server-module.cjs",
        serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "shared-runtime-theme",
      name: "Broken Content Shared Runtime Theme",
      description: "This theme must be released when content validation fails."
    }
  ],
  contentPacks: [
    {
      id: "broken-content-theme-pack",
      name: "Broken Content Theme Pack",
      description: "Invalidates the theme owner after theme defaults are inspected.",
      defaultSiteThemeId: "shared-runtime-theme",
      defaultMapId: "missing-map",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
      },
      {
        dir: "demo.valid-content-theme-owner",
        manifest: {
          schemaVersion: 1,
          id: "demo.valid-content-theme-owner",
          version: "1.0.0",
          displayName: "Demo Valid Content Theme Owner",
          engineVersion: "1.0.0",
          kind: "hybrid",
          dependencies: [{ id: "core.base", version: "1.x" }],
          conflicts: [],
          capabilities: [
            {
              kind: "site-theme",
              scope: "global",
              description: "Valid owner after invalid content owner releases the id"
            }
          ],
          entrypoints: {
            server: "server-module.cjs"
          }
        },
        serverEntryPath: "server-module.cjs",
        serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "shared-runtime-theme",
      name: "Valid Content Shared Runtime Theme",
      description: "This module should own the released theme id."
    }
  ]
};`
      }
    ],
    async ({ app, adminSessionToken }) => {
      const enableResponse = await callApp(
        app,
        "POST",
        "/api/modules/demo.valid-content-theme-owner/enable",
        {},
        authHeaders(adminSessionToken)
      );
      assert.equal(enableResponse.statusCode, 200);

      const brokenModule = enableResponse.payload.modules.find(
        (entry: any) => entry.id === "demo.aaa-content-broken-theme-owner"
      );
      assert.equal(brokenModule.status, "incompatible");
      assert.equal(
        brokenModule.errors.some((entry: string) => entry.includes("missing-map")),
        true
      );

      const validModule = enableResponse.payload.modules.find(
        (entry: any) => entry.id === "demo.valid-content-theme-owner"
      );
      assert.equal(validModule.status, "enabled");
      assert.equal(validModule.errors.length, 0);

      const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
      assert.equal(moduleOptionsResponse.statusCode, 200);
      assert.equal(
        moduleOptionsResponse.payload.themes.some(
          (entry: any) =>
            entry.id === "shared-runtime-theme" &&
            entry.name === "Valid Content Shared Runtime Theme"
        ),
        true
      );
      assert.equal(
        moduleOptionsResponse.payload.themes.some(
          (entry: any) =>
            entry.id === "shared-runtime-theme" &&
            entry.name === "Broken Content Shared Runtime Theme"
        ),
        false
      );
    }
  );
});

register(
  "module runtime ricalcola conflitti tema dopo la revalidazione dei content pack",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.aaa-revalidated-theme-owner",
          manifest: {
            schemaVersion: 1,
            id: "demo.aaa-revalidated-theme-owner",
            version: "1.0.0",
            displayName: "Demo Revalidated Theme Owner",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [
              { id: "core.base", version: "1.x" },
              { id: "demo.zzz-late-invalid-theme-provider", version: "1.x" }
            ],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Theme owner invalidated by content-pack revalidation"
              },
              {
                kind: "content-pack",
                scope: "game",
                description: "Content pack that depends on a provider later invalidated"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "shared-runtime-theme",
      name: "Revalidated Broken Shared Runtime Theme",
      description: "This theme owner becomes incompatible after content-pack revalidation."
    }
  ],
  contentPacks: [
    {
      id: "revalidated-theme-pack",
      name: "Revalidated Theme Pack",
      description: "References a provider theme that becomes unavailable.",
      defaultSiteThemeId: "late-invalid-provider-theme",
      defaultMapId: "classic-mini",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
        },
        {
          dir: "demo.valid-recomputed-theme-owner",
          manifest: {
            schemaVersion: 1,
            id: "demo.valid-recomputed-theme-owner",
            version: "1.0.0",
            displayName: "Demo Valid Recomputed Theme Owner",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Valid owner after revalidation removes the first owner"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "shared-runtime-theme",
      name: "Valid Recomputed Shared Runtime Theme",
      description: "This module should own the theme after revalidation."
    }
  ]
};`
        },
        {
          dir: "demo.zzz-late-invalid-theme-provider",
          manifest: {
            schemaVersion: 1,
            id: "demo.zzz-late-invalid-theme-provider",
            version: "1.0.0",
            displayName: "Demo Late Invalid Theme Provider",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Provider theme invalidated by its own content pack"
              },
              {
                kind: "content-pack",
                scope: "game",
                description: "Invalid content pack"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "late-invalid-provider-theme",
      name: "Late Invalid Provider Theme",
      description: "This provider becomes incompatible after initial content-pack validation."
    }
  ],
  contentPacks: [
    {
      id: "late-invalid-provider-pack",
      name: "Late Invalid Provider Pack",
      description: "Invalidates the provider after consumers have been inspected.",
      defaultSiteThemeId: "late-invalid-provider-theme",
      defaultMapId: "missing-map",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        await app.datastore.setAppState("moduleCatalogState", {
          enabledById: {
            "core.base": true,
            "demo.aaa-revalidated-theme-owner": true,
            "demo.valid-recomputed-theme-owner": true,
            "demo.zzz-late-invalid-theme-provider": true
          },
          updatedAt: "2026-04-26T00:00:00.000Z"
        });

        const moduleOptionsResponse = await callApp(
          app,
          "GET",
          "/api/modules/options",
          undefined,
          authHeaders(adminSessionToken)
        );
        assert.equal(moduleOptionsResponse.statusCode, 200);

        const revalidatedModule = moduleOptionsResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.aaa-revalidated-theme-owner"
        );
        assert.equal(revalidatedModule.status, "incompatible");
        assert.equal(
          revalidatedModule.errors.some((entry: string) =>
            entry.includes("late-invalid-provider-theme")
          ),
          true
        );

        const validModule = moduleOptionsResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.valid-recomputed-theme-owner"
        );
        assert.equal(validModule.status, "enabled");
        assert.equal(validModule.errors.length, 0);

        assert.equal(
          moduleOptionsResponse.payload.themes.some(
            (entry: any) =>
              entry.id === "shared-runtime-theme" &&
              entry.name === "Valid Recomputed Shared Runtime Theme"
          ),
          true
        );
      }
    );
  }
);

register(
  "module runtime riassegna temi quando la seconda revalidazione libera il proprietario",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.aaa-late-dropped-theme-owner",
          manifest: {
            schemaVersion: 1,
            id: "demo.aaa-late-dropped-theme-owner",
            version: "1.0.0",
            displayName: "Demo Late Dropped Theme Owner",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Initial owner that later loses a dependent theme"
              },
              {
                kind: "content-pack",
                scope: "game",
                description: "Depends on a theme from the duplicate loser"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "shared-runtime-theme",
      name: "Late Dropped Shared Runtime Theme",
      description: "This owner is removed after the duplicate loser becomes incompatible."
    }
  ],
  contentPacks: [
    {
      id: "late-dropped-theme-pack",
      name: "Late Dropped Theme Pack",
      description: "Invalidates this owner after the duplicate loser has been inspected.",
      defaultSiteThemeId: "shared-runtime-theme",
      defaultMapId: "missing-map",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
        },
        {
          dir: "demo.valid-late-theme-owner",
          manifest: {
            schemaVersion: 1,
            id: "demo.valid-late-theme-owner",
            version: "1.0.0",
            displayName: "Demo Valid Late Theme Owner",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              {
                kind: "site-theme",
                scope: "global",
                description: "Valid owner after the initial owner drops out"
              },
              {
                kind: "content-pack",
                scope: "game",
                description: "Valid content pack should return with the recovered module"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  siteThemes: [
    {
      id: "shared-runtime-theme",
      name: "Valid Late Shared Runtime Theme",
      description: "This module should be reconsidered after the first owner drops out."
    },
    {
      id: "late-helper-theme",
      name: "Late Helper Theme",
      description: "This helper disappears while the module is a duplicate loser."
    }
  ],
  contentPacks: [
    {
      id: "valid-late-owner-pack",
      name: "Valid Late Owner Pack",
      description: "This pack should be re-registered after theme conflict recovery.",
      defaultSiteThemeId: "shared-runtime-theme",
      defaultMapId: "classic-mini",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
        },
        {
          dir: "demo.zzz-dependent-recovered-pack",
          manifest: {
            schemaVersion: 1,
            id: "demo.zzz-dependent-recovered-pack",
            version: "1.0.0",
            displayName: "Demo Dependent Recovered Pack",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [
              { id: "core.base", version: "1.x" },
              { id: "demo.valid-late-theme-owner", version: "1.x" }
            ],
            conflicts: [],
            capabilities: [
              {
                kind: "content-pack",
                scope: "game",
                description: "Depends on a provider theme that is temporarily unavailable"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  contentPacks: [
    {
      id: "dependent-late-helper-pack",
      name: "Dependent Late Helper Pack",
      description: "This pack should recover after its provider regains the helper theme.",
      defaultSiteThemeId: "late-helper-theme",
      defaultMapId: "classic-mini",
      defaultDiceRuleSetId: "standard",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "conquest",
      defaultPieceSetId: "classic"
    }
  ]
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        await app.datastore.setAppState("moduleCatalogState", {
          enabledById: {
            "core.base": true,
            "demo.aaa-late-dropped-theme-owner": true,
            "demo.valid-late-theme-owner": true,
            "demo.zzz-dependent-recovered-pack": true
          },
          updatedAt: "2026-04-26T00:00:00.000Z"
        });

        const moduleOptionsResponse = await callApp(
          app,
          "GET",
          "/api/modules/options",
          undefined,
          authHeaders(adminSessionToken)
        );
        assert.equal(moduleOptionsResponse.statusCode, 200);

        const droppedModule = moduleOptionsResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.aaa-late-dropped-theme-owner"
        );
        assert.equal(droppedModule.status, "incompatible");
        assert.equal(
          droppedModule.errors.some((entry: string) => entry.includes("missing-map")),
          true
        );

        const validModule = moduleOptionsResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.valid-late-theme-owner"
        );
        assert.equal(validModule.status, "enabled");
        assert.equal(validModule.errors.length, 0);

        const dependentModule = moduleOptionsResponse.payload.modules.find(
          (entry: any) => entry.id === "demo.zzz-dependent-recovered-pack"
        );
        assert.equal(dependentModule.status, "enabled");
        assert.equal(dependentModule.errors.length, 0);

        assert.equal(
          moduleOptionsResponse.payload.themes.some(
            (entry: any) =>
              entry.id === "shared-runtime-theme" &&
              entry.name === "Valid Late Shared Runtime Theme"
          ),
          true
        );
        assert.equal(
          moduleOptionsResponse.payload.content.contentPackIds.includes("valid-late-owner-pack"),
          true
        );
        assert.equal(
          moduleOptionsResponse.payload.content.contentPackIds.includes(
            "dependent-late-helper-pack"
          ),
          true
        );

        const gameOptionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(gameOptionsResponse.statusCode, 200);
        assert.equal(
          gameOptionsResponse.payload.contentPacks.some(
            (entry: any) =>
              entry.id === "valid-late-owner-pack" &&
              entry.defaultSiteThemeId === "shared-runtime-theme"
          ),
          true
        );
        assert.equal(
          gameOptionsResponse.payload.contentPacks.some(
            (entry: any) =>
              entry.id === "dependent-late-helper-pack" &&
              entry.defaultSiteThemeId === "late-helper-theme"
          ),
          true
        );
      }
    );
  }
);

register(
  "module runtime espone content pack locali e li usa come defaults in creazione partita",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.content-packs",
          manifest: {
            schemaVersion: 1,
            id: "demo.content-packs",
            version: "1.0.0",
            displayName: "Demo Content Packs",
            engineVersion: "1.0.0",
            kind: "content",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              { kind: "map", scope: "game", description: "Runtime module maps" },
              { kind: "content-pack", scope: "game", description: "Runtime module content packs" }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json",
              server: "server-module.cjs"
            }
          },
          clientManifest: {},
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  maps: [
    {
      id: "demo-packlands",
      name: "Demo Packlands",
      territoryRecords: [
        { id: "pack-north", name: "Pack North", continentId: "pack-alpha", x: 0.2, y: 0.2, neighbors: ["pack-south", "pack-east"] },
        { id: "pack-south", name: "Pack South", continentId: "pack-alpha", x: 0.2, y: 0.75, neighbors: ["pack-north", "pack-west"] },
        { id: "pack-east", name: "Pack East", continentId: "pack-beta", x: 0.75, y: 0.25, neighbors: ["pack-north", "pack-west"] },
        { id: "pack-west", name: "Pack West", continentId: "pack-beta", x: 0.75, y: 0.75, neighbors: ["pack-south", "pack-east"] }
      ],
      continentRecords: [
        { id: "pack-alpha", name: "Pack Alpha", bonus: 2, territoryIds: ["pack-north", "pack-south"] },
        { id: "pack-beta", name: "Pack Beta", bonus: 3, territoryIds: ["pack-east", "pack-west"] }
      ]
    }
  ],
  contentPacks: [
    {
      id: "demo-command-pack",
      name: "Demo Command Pack",
      description: "Runtime command pack for modular setup.",
      defaultSiteThemeId: "ember",
      defaultMapId: "demo-packlands",
      defaultDiceRuleSetId: "defense-3",
      defaultCardRuleSetId: "standard",
      defaultVictoryRuleSetId: "majority-control",
      defaultPieceSetId: "classic"
    }
  ]
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.content-packs/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);

        const optionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(optionsResponse.statusCode, 200);
        assert.equal(
          optionsResponse.payload.contentPacks.some(
            (entry: any) =>
              entry.id === "demo-command-pack" && entry.defaultMapId === "demo-packlands"
          ),
          true
        );

        const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
        assert.equal(moduleOptionsResponse.statusCode, 200);
        assert.equal(
          moduleOptionsResponse.payload.content.contentPackIds.includes("demo-command-pack"),
          true
        );

        const missingModuleSelectionResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Missing Content Pack Module",
            contentPackId: "demo-command-pack",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );
        assert.equal(missingModuleSelectionResponse.statusCode, 400);
        assert.equal(
          String(
            missingModuleSelectionResponse.payload.error ||
              missingModuleSelectionResponse.payload.message
          ).includes("Selected content pack"),
          true
        );

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Runtime Content Pack",
            activeModuleIds: ["demo.content-packs"],
            contentPackId: "demo-command-pack",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(createGameResponse.statusCode, 201);
        assert.equal(
          createGameResponse.payload.state.gameConfig.contentPackId,
          "demo-command-pack"
        );
        assert.equal(createGameResponse.payload.state.gameConfig.mapId, "demo-packlands");
        assert.equal(createGameResponse.payload.state.gameConfig.pieceSetId, "classic");
        assert.equal(
          createGameResponse.payload.state.gameConfig.activeModules.some(
            (entry: any) => entry.id === "demo.content-packs"
          ),
          true
        );
        assert.equal(createGameResponse.payload.state.map.length, 4);
        assert.equal(
          createGameResponse.payload.state.map.some((entry: any) => entry.id === "pack-north"),
          true
        );
      }
    );
  }
);

register(
  "module runtime espone player piece set locali e li usa per i colori lobby della partita",
  async () => {
    await withModuleServer(
      [
        {
          dir: "demo.piece-sets",
          manifest: {
            schemaVersion: 1,
            id: "demo.piece-sets",
            version: "1.0.0",
            displayName: "Demo Piece Sets",
            engineVersion: "1.0.0",
            kind: "content",
            dependencies: [{ id: "core.base", version: "1.x" }],
            conflicts: [],
            capabilities: [
              { kind: "player-piece-set", scope: "game", description: "Runtime module piece sets" }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  playerPieceSets: [
    {
      id: "signal-palette",
      name: "Signal Palette",
      palette: ["#112233", "#445566", "#778899", "#99aabb"]
    }
  ]
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.piece-sets/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableResponse.statusCode, 200);

        const optionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(optionsResponse.statusCode, 200);
        assert.equal(
          optionsResponse.payload.playerPieceSets.some(
            (entry: any) => entry.id === "signal-palette" && entry.paletteSize === 4
          ),
          true
        );

        const missingModuleSelectionResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Missing Piece Set Module",
            pieceSetId: "signal-palette",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );
        assert.equal(missingModuleSelectionResponse.statusCode, 400);
        assert.equal(
          String(
            missingModuleSelectionResponse.payload.error ||
              missingModuleSelectionResponse.payload.message
          ).includes("Selected piece set"),
          true
        );

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Runtime Piece Set",
            activeModuleIds: ["demo.piece-sets"],
            pieceSetId: "signal-palette",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(createGameResponse.statusCode, 201);
        assert.equal(createGameResponse.payload.state.gameConfig.pieceSetId, "signal-palette");
        assert.equal(createGameResponse.payload.state.gameConfig.pieceSetName, "Signal Palette");
        assert.deepEqual(createGameResponse.payload.state.gameConfig.pieceSetPalette, [
          "#112233",
          "#445566",
          "#778899",
          "#99aabb"
        ]);
        assert.equal(createGameResponse.payload.state.gameConfig.pieceSet.id, "signal-palette");
        assert.equal(createGameResponse.payload.state.players[0].color, "#112233");

        const secondRegistered = await app.auth.registerPasswordUser("piece_guest", "secret123");
        assert.equal(secondRegistered.ok, true);
        const secondLogin = await app.auth.loginWithPassword("piece_guest", "secret123");
        assert.equal(secondLogin.ok, true);

        const joinResponse = await callApp(
          app,
          "POST",
          "/api/join",
          {
            gameId: createGameResponse.payload.game.id
          },
          authHeaders(secondLogin.sessionToken)
        );

        assert.equal(joinResponse.statusCode, 201);
        assert.equal(joinResponse.payload.state.players[1].color, "#445566");
      }
    );
  }
);

register(
  "module runtime keeps rule sets selectable when content filters preset defaults",
  async () => {
    await withModuleServer(
      [
        {
          dir: "core.base",
          manifest: {
            schemaVersion: 1,
            id: "core.base",
            version: "1.0.0",
            displayName: "Core Restricted Overrides",
            engineVersion: "1.0.0",
            kind: "hybrid",
            dependencies: [],
            conflicts: [],
            capabilities: [
              { kind: "map", scope: "game", description: "Restricted core maps" },
              { kind: "site-theme", scope: "global", description: "Restricted core themes" }
            ],
            entrypoints: {
              clientManifest: "client-manifest.json"
            }
          },
          clientManifest: {
            content: {
              mapIds: ["world-classic"],
              siteThemeIds: ["ember"],
              pieceSkinIds: ["command-ring"],
              playerPieceSetIds: ["classic"],
              contentPackIds: ["core"],
              diceRuleSetIds: ["standard"],
              cardRuleSetIds: ["standard"],
              victoryRuleSetIds: ["majority-control"],
              fortifyRuleSetIds: ["standard"],
              reinforcementRuleSetIds: ["standard"]
            }
          }
        }
      ],
      async ({ app, adminSessionToken }) => {
        const optionsResponse = await callApp(app, "GET", "/api/game/options");
        assert.equal(optionsResponse.statusCode, 200);
        assert.deepEqual(
          optionsResponse.payload.resolvedCatalog.ruleSets.map((entry: any) => entry.id),
          ["classic", "classic-defense-3"]
        );

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Restricted Preset Defaults",
            ruleSetId: "classic",
            mapId: "world-classic",
            diceRuleSetId: "standard",
            victoryRuleSetId: "majority-control",
            themeId: "ember",
            pieceSkinId: "command-ring",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );
        assert.equal(createGameResponse.statusCode, 201);
        assert.equal(createGameResponse.payload.state.gameConfig.ruleSetId, "classic");
        assert.equal(createGameResponse.payload.state.gameConfig.mapId, "world-classic");
        assert.equal(
          createGameResponse.payload.state.gameConfig.victoryRuleSetId,
          "majority-control"
        );
        assert.equal(createGameResponse.payload.state.gameConfig.themeId, "ember");
        assert.equal(createGameResponse.payload.state.gameConfig.pieceSkinId, "command-ring");
      }
    );
  }
);

register("module runtime espone dice rule set locali e li usa in creazione partita", async () => {
  await withModuleServer(
    [
      {
        dir: "demo.dice-rules",
        manifest: {
          schemaVersion: 1,
          id: "demo.dice-rules",
          version: "1.0.0",
          displayName: "Demo Dice Rules",
          engineVersion: "1.0.0",
          kind: "content",
          dependencies: [{ id: "core.base", version: "1.x" }],
          conflicts: [],
          capabilities: [
            { kind: "dice-rule-set", scope: "game", description: "Runtime module dice rules" }
          ],
          entrypoints: {
            server: "server-module.cjs"
          }
        },
        serverEntryPath: "server-module.cjs",
        serverEntrySource: `module.exports = {
  diceRuleSets: [
    {
      id: "duel",
      name: "Duel",
      attackerMaxDice: 2,
      defenderMaxDice: 1,
      attackerMustLeaveOneArmyBehind: true,
      defenderWinsTies: true
    }
  ]
};`
      }
    ],
    async ({ app, adminSessionToken }) => {
      const enableResponse = await callApp(
        app,
        "POST",
        "/api/modules/demo.dice-rules/enable",
        {},
        authHeaders(adminSessionToken)
      );
      assert.equal(enableResponse.statusCode, 200);

      const optionsResponse = await callApp(app, "GET", "/api/game/options");
      assert.equal(optionsResponse.statusCode, 200);
      assert.equal(
        optionsResponse.payload.diceRuleSets.some(
          (entry: any) =>
            entry.id === "duel" && entry.attackerMaxDice === 2 && entry.defenderMaxDice === 1
        ),
        true
      );

      const missingModuleSelectionResponse = await callApp(
        app,
        "POST",
        "/api/games",
        {
          name: "Missing Dice Module",
          diceRuleSetId: "duel",
          totalPlayers: 2,
          players: [{ type: "human" }, { type: "human" }]
        },
        authHeaders(adminSessionToken)
      );
      assert.equal(missingModuleSelectionResponse.statusCode, 400);
      assert.equal(
        String(
          missingModuleSelectionResponse.payload.error ||
            missingModuleSelectionResponse.payload.message
        ).includes("Selected dice rule set"),
        true
      );

      const createGameResponse = await callApp(
        app,
        "POST",
        "/api/games",
        {
          name: "Runtime Dice Rule",
          activeModuleIds: ["demo.dice-rules"],
          diceRuleSetId: "duel",
          totalPlayers: 2,
          players: [{ type: "human" }, { type: "human" }]
        },
        authHeaders(adminSessionToken)
      );

      assert.equal(createGameResponse.statusCode, 201);
      assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "duel");
      assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetName, "Duel");
      assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetAttackerMaxDice, 2);
      assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetDefenderMaxDice, 1);
      assert.equal(createGameResponse.payload.state.diceRuleSet.id, "duel");
      assert.equal(createGameResponse.payload.state.diceRuleSet.attackerMaxDice, 2);
      assert.equal(createGameResponse.payload.state.diceRuleSet.defenderMaxDice, 1);
    }
  );
});

register("module runtime espone e risolve game preset modulari nel setup partita", async () => {
  await withModuleServer(
    [
      {
        dir: "demo.presets",
        manifest: {
          schemaVersion: 1,
          id: "demo.presets",
          version: "1.0.0",
          displayName: "Demo Presets",
          engineVersion: "1.0.0",
          kind: "hybrid",
          dependencies: [{ id: "core.base", version: "1.x" }],
          conflicts: [],
          capabilities: [
            {
              kind: "gameplay-hook",
              scope: "game",
              hook: "setup.profile",
              description: "Preset setup profile"
            }
          ],
          entrypoints: {
            clientManifest: "client-manifest.json",
            server: "server-module.cjs"
          }
        },
        clientManifest: {
          gamePresets: [
            {
              id: "demo.presets.command-preset",
              name: "Command Preset",
              activeModuleIds: ["demo.presets"],
              contentProfileId: "demo.presets.content",
              gameplayProfileId: "demo.presets.gameplay",
              uiProfileId: "demo.presets.ui",
              defaults: {
                mapId: "classic-mini",
                themeId: "command"
              }
            }
          ],
          profiles: {
            content: [{ id: "demo.presets.content", name: "Preset Content" }],
            gameplay: [{ id: "demo.presets.gameplay", name: "Preset Gameplay" }],
            ui: [{ id: "demo.presets.ui", name: "Preset UI" }]
          }
        },
        serverEntryPath: "server-module.cjs",
        serverEntrySource: `module.exports = {
  profiles: {
    content: [
      { id: "demo.presets.content", defaults: { mapId: "world-classic" } }
    ],
    gameplay: [
      { id: "demo.presets.gameplay", defaults: { ruleSetId: "classic-defense-3", diceRuleSetId: "defense-3", victoryRuleSetId: "majority-control" } }
    ],
    ui: [
      { id: "demo.presets.ui", defaults: { themeId: "ember", pieceSkinId: "command-ring" } }
    ]
  }
};`
      }
    ],
    async ({ app, adminSessionToken }) => {
      const enableResponse = await callApp(
        app,
        "POST",
        "/api/modules/demo.presets/enable",
        {},
        authHeaders(adminSessionToken)
      );
      assert.equal(enableResponse.statusCode, 200);

      const optionsResponse = await callApp(app, "GET", "/api/game/options");
      assert.equal(optionsResponse.statusCode, 200);
      assert.equal(
        optionsResponse.payload.gamePresets.some(
          (entry: any) => entry.id === "demo.presets.command-preset"
        ),
        true
      );

      const createGameResponse = await callApp(
        app,
        "POST",
        "/api/games",
        {
          name: "Preset Game",
          gamePresetId: "demo.presets.command-preset",
          totalPlayers: 2,
          players: [{ type: "human" }, { type: "ai" }]
        },
        authHeaders(adminSessionToken)
      );

      assert.equal(createGameResponse.statusCode, 201);
      assert.equal(
        createGameResponse.payload.state.gameConfig.gamePresetId,
        "demo.presets.command-preset"
      );
      assert.equal(createGameResponse.payload.state.gameConfig.mapId, "classic-mini");
      assert.equal(createGameResponse.payload.state.gameConfig.themeId, "command");
      assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
      assert.equal(
        createGameResponse.payload.state.gameConfig.victoryRuleSetId,
        "majority-control"
      );
      assert.equal(createGameResponse.payload.state.gameConfig.pieceSkinId, "command-ring");
      assert.equal(
        createGameResponse.payload.state.gameConfig.activeModules.some(
          (entry: any) => entry.id === "demo.presets"
        ),
        true
      );
      assert.equal(
        createGameResponse.payload.state.gameConfig.contentProfileId,
        "demo.presets.content"
      );
      assert.equal(
        createGameResponse.payload.state.gameConfig.gameplayProfileId,
        "demo.presets.gameplay"
      );
      assert.equal(createGameResponse.payload.state.gameConfig.uiProfileId, "demo.presets.ui");

      const gameListResponse = await callApp(app, "GET", "/api/games");
      assert.equal(gameListResponse.statusCode, 200);
      const listedGame = gameListResponse.payload.games.find(
        (entry: any) => entry.id === createGameResponse.payload.game.id
      );
      assert.equal(Boolean(listedGame), true);
      assert.equal(listedGame.gamePresetId, "demo.presets.command-preset");
      assert.equal(
        listedGame.activeModules.some((entry: any) => entry.id === "demo.presets"),
        true
      );
      assert.equal(listedGame.contentProfileId, "demo.presets.content");
      assert.equal(listedGame.gameplayProfileId, "demo.presets.gameplay");
      assert.equal(listedGame.uiProfileId, "demo.presets.ui");
    }
  );
});
