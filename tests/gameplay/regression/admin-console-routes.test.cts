const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("../../../backend/server.cjs");
const { createAdminConsole } = require("../../../backend/admin-console.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type HeaderMap = Record<string, string>;

type MockResponse = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number, nextHeaders?: HeaderMap): void;
  end(chunk?: string): void;
};

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
): Promise<{ statusCode: number; payload: any }> {
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

async function withAdminApp(
  run: (context: { app: any; adminSessionToken: string; tempRoot: string }) => Promise<void>
) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-admin-"));
  const dataDir = path.join(tempRoot, "data");
  const frontendDir = path.join(tempRoot, "frontend", "src");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(frontendDir, { recursive: true });

  const originalProjectRoot = process.env.NETRISK_PROJECT_ROOT;
  process.env.NETRISK_PROJECT_ROOT = tempRoot;

  const tempDbFile = path.join(tempRoot, "data", "admin.sqlite");
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
    const registered = await app.auth.registerPasswordUser("admin_commander", "secret123");
    assert.equal(registered.ok, true);
    await app.datastore.updateUserRoleByUsername("admin_commander", "admin");
    const login = await app.auth.loginWithPassword("admin_commander", "secret123");
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

async function withModuleAdminApp(
  modules: Array<{
    dir: string;
    manifest?: unknown;
    clientManifest?: unknown;
    rawManifest?: string;
    serverEntryPath?: string;
    serverEntrySource?: string;
  }>,
  run: (context: { app: any; adminSessionToken: string; tempRoot: string }) => Promise<void>
) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-admin-modules-"));
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

  const tempDbFile = path.join(tempRoot, "data", "admin.sqlite");
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
    const registered = await app.auth.registerPasswordUser("admin_commander", "secret123");
    assert.equal(registered.ok, true);
    await app.datastore.updateUserRoleByUsername("admin_commander", "admin");
    const login = await app.auth.loginWithPassword("admin_commander", "secret123");
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

register("admin console overview rejects anonymous and non-admin access", async () => {
  await withAdminApp(async ({ app }) => {
    const anonymousResponse = await callApp(app, "GET", "/api/admin/overview");
    assert.equal(anonymousResponse.statusCode, 401);
    assert.equal(anonymousResponse.payload.code, "AUTH_REQUIRED");

    const registered = await app.auth.registerPasswordUser("field_captain", "secret123");
    assert.equal(registered.ok, true);
    const login = await app.auth.loginWithPassword("field_captain", "secret123");
    assert.equal(login.ok, true);

    const nonAdminResponse = await callApp(
      app,
      "GET",
      "/api/admin/overview",
      undefined,
      authHeaders(login.sessionToken)
    );
    assert.equal(nonAdminResponse.statusCode, 403);
    assert.equal(nonAdminResponse.payload.code, "ADMIN_ONLY");
  });
});

register("admin console can promote a user and grant admin access", async () => {
  await withAdminApp(async ({ app, adminSessionToken }) => {
    const registered = await app.auth.registerPasswordUser("operations_guest", "secret123");
    assert.equal(registered.ok, true);
    const guestLogin = await app.auth.loginWithPassword("operations_guest", "secret123");
    assert.equal(guestLogin.ok, true);
    const storedUser = await app.datastore.findUserByUsername("operations_guest");
    assert.ok(storedUser);

    const promoteResponse = await callApp(
      app,
      "POST",
      "/api/admin/users/role",
      {
        userId: storedUser.id,
        role: "admin"
      },
      authHeaders(adminSessionToken)
    );

    assert.equal(promoteResponse.statusCode, 200);
    assert.equal(promoteResponse.payload.user.role, "admin");
    assert.equal(promoteResponse.payload.audit.action, "user.role.update");

    const elevatedResponse = await callApp(
      app,
      "GET",
      "/api/admin/overview",
      undefined,
      authHeaders(guestLogin.sessionToken)
    );
    assert.equal(elevatedResponse.statusCode, 200);
    assert.equal(elevatedResponse.payload.summary.adminUsers >= 2, true);
  });
});

register("admin console updates defaults and new game creation consumes them", async () => {
  await withAdminApp(async ({ app, adminSessionToken }) => {
    const configResponse = await callApp(
      app,
      "PUT",
      "/api/admin/config",
      {
        defaults: {
          themeId: "ember",
          mapId: "middle-earth",
          diceRuleSetId: "defense-3",
          victoryRuleSetId: "majority-control",
          pieceSkinId: "command-ring",
          totalPlayers: 3
        },
        maintenance: {
          staleLobbyDays: 5,
          auditLogLimit: 150
        }
      },
      authHeaders(adminSessionToken)
    );

    assert.equal(configResponse.statusCode, 200);
    assert.equal(configResponse.payload.config.defaults.themeId, "ember");
    assert.equal(configResponse.payload.config.defaults.mapId, "middle-earth");
    assert.equal(configResponse.payload.config.defaults.totalPlayers, 3);

    const optionsResponse = await callApp(app, "GET", "/api/game/options");
    assert.equal(optionsResponse.statusCode, 200);
    assert.equal(optionsResponse.payload.adminDefaults.themeId, "ember");
    assert.equal(optionsResponse.payload.adminDefaults.mapId, "middle-earth");
    assert.equal(optionsResponse.payload.adminDefaults.diceRuleSetId, "defense-3");
    assert.equal(optionsResponse.payload.adminDefaults.victoryRuleSetId, "majority-control");
    assert.equal(optionsResponse.payload.adminDefaults.pieceSkinId, "command-ring");
    assert.equal(optionsResponse.payload.adminDefaults.totalPlayers, 3);

    const createGameResponse = await callApp(
      app,
      "POST",
      "/api/games",
      {
        name: "Admin Default Match"
      },
      authHeaders(adminSessionToken)
    );
    assert.equal(createGameResponse.statusCode, 201);
    assert.equal(createGameResponse.payload.state.gameConfig.themeId, "ember");
    assert.equal(createGameResponse.payload.state.gameConfig.mapId, "middle-earth");
    assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
    assert.equal(createGameResponse.payload.state.gameConfig.victoryRuleSetId, "majority-control");
    assert.equal(createGameResponse.payload.state.gameConfig.pieceSkinId, "command-ring");
    assert.equal(createGameResponse.payload.state.gameConfig.totalPlayers, 3);
  });
});

register(
  "admin module defaults seed module selection and profile defaults in backend-created games",
  async () => {
    await withModuleAdminApp(
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
        defaults: {
          ruleSetId: "classic-defense-3",
          diceRuleSetId: "defense-3",
          victoryRuleSetId: "majority-control"
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

        const configResponse = await callApp(
          app,
          "PUT",
          "/api/admin/config",
          {
            defaults: {
              activeModuleIds: ["demo.defaults"],
              contentProfileId: "demo.defaults.content",
              gameplayProfileId: "demo.defaults.gameplay",
              uiProfileId: "demo.defaults.ui"
            }
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(configResponse.statusCode, 200);
        assert.deepEqual(configResponse.payload.config.defaults.activeModuleIds, [
          "core.base",
          "demo.defaults"
        ]);
        assert.equal(
          configResponse.payload.config.defaults.contentProfileId,
          "demo.defaults.content"
        );
        assert.equal(
          configResponse.payload.config.defaults.gameplayProfileId,
          "demo.defaults.gameplay"
        );
        assert.equal(configResponse.payload.config.defaults.uiProfileId, "demo.defaults.ui");

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Admin Module Defaults"
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(createGameResponse.statusCode, 201);
        assert.deepEqual(
          createGameResponse.payload.state.gameConfig.activeModules.map(
            (entry: { id: string }) => entry.id
          ),
          ["core.base", "demo.defaults"]
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.contentProfileId,
          "demo.defaults.content"
        );
        assert.equal(
          createGameResponse.payload.state.gameConfig.gameplayProfileId,
          "demo.defaults.gameplay"
        );
        assert.equal(createGameResponse.payload.state.gameConfig.uiProfileId, "demo.defaults.ui");
        assert.equal(createGameResponse.payload.state.gameConfig.mapId, "world-classic");
        assert.equal(createGameResponse.payload.state.gameConfig.ruleSetId, "classic-defense-3");
        assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
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

register("public game options ignore stale invalid admin defaults instead of failing", async () => {
  await withAdminApp(async ({ app, adminSessionToken }) => {
    const configResponse = await callApp(
      app,
      "PUT",
      "/api/admin/config",
      {
        defaults: {
          activeModuleIds: ["demo.missing-module"],
          gamePresetId: "demo.missing-preset"
        }
      },
      authHeaders(adminSessionToken)
    );

    assert.equal(configResponse.statusCode, 400);

    await app.datastore.setAppState("adminConsoleConfig", {
      defaults: {
        activeModuleIds: ["demo.missing-module"],
        gamePresetId: "demo.missing-preset"
      },
      maintenance: {
        staleLobbyDays: 7,
        auditLogLimit: 120
      },
      updatedAt: new Date().toISOString(),
      updatedBy: {
        id: "admin_commander",
        username: "admin_commander",
        role: "admin"
      }
    });

    const optionsResponse = await callApp(app, "GET", "/api/game/options");
    assert.equal(optionsResponse.statusCode, 200);
    assert.equal("adminDefaults" in optionsResponse.payload, false);

    const createGameResponse = await callApp(
      app,
      "POST",
      "/api/games",
      {
        name: "Fallback Config Match"
      },
      authHeaders(adminSessionToken)
    );
    assert.equal(createGameResponse.statusCode, 201);
    assert.equal(createGameResponse.payload.state.gameConfig.mapId, "classic-mini");
  });
});

register("admin console can close a lobby with explicit confirmation", async () => {
  await withAdminApp(async ({ app, adminSessionToken }) => {
    const createGameResponse = await callApp(
      app,
      "POST",
      "/api/games",
      {
        name: "Abandoned Lobby"
      },
      authHeaders(adminSessionToken)
    );

    assert.equal(createGameResponse.statusCode, 201);
    const gameId = createGameResponse.payload.game.id;

    const closeResponse = await callApp(
      app,
      "POST",
      "/api/admin/games/action",
      {
        gameId,
        action: "close-lobby",
        confirmation: gameId
      },
      authHeaders(adminSessionToken)
    );

    assert.equal(closeResponse.statusCode, 200);
    assert.equal(closeResponse.payload.game.phase, "finished");
    assert.equal(closeResponse.payload.audit.action, "game.close-lobby");
  });
});

register(
  "admin repair preserves runtime dice rule ids while fixing the stored snapshot",
  async () => {
    await withModuleAdminApp(
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
              {
                kind: "dice-rule-set",
                scope: "game",
                description: "Runtime dice rules"
              }
            ],
            entrypoints: {
              server: "server-module.cjs"
            }
          },
          serverEntryPath: "server-module.cjs",
          serverEntrySource: `module.exports = {
  diceRuleSets: [
    {
      id: "demo-barrage",
      name: "Demo Barrage",
      attackerMaxDice: 4,
      defenderMaxDice: 2,
      attackerMustLeaveOneArmyBehind: true,
      defenderWinsTies: true
    }
  ]
};`
        }
      ],
      async ({ app, adminSessionToken }) => {
        const enableModuleResponse = await callApp(
          app,
          "POST",
          "/api/modules/demo.dice-rules/enable",
          {},
          authHeaders(adminSessionToken)
        );
        assert.equal(enableModuleResponse.statusCode, 200);

        const createGameResponse = await callApp(
          app,
          "POST",
          "/api/games",
          {
            name: "Runtime Repair",
            activeModuleIds: ["demo.dice-rules"],
            diceRuleSetId: "demo-barrage",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "human" }]
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(createGameResponse.statusCode, 201);
        const gameId = createGameResponse.payload.game.id;
        const storedGame = await app.datastore.findGameById(gameId);
        assert.ok(storedGame);

        storedGame.state.gameConfig.diceRuleSetId = "demo-barrage";
        storedGame.state.gameConfig.diceRuleSetName = "Demo Barrage";
        storedGame.state.diceRuleSetId = "standard";
        storedGame.updatedAt = new Date().toISOString();
        await app.datastore.updateGame(storedGame);

        const repairResponse = await callApp(
          app,
          "POST",
          "/api/admin/games/action",
          {
            gameId,
            action: "repair-game-config"
          },
          authHeaders(adminSessionToken)
        );

        assert.equal(repairResponse.statusCode, 200);
        assert.equal(repairResponse.payload.rawState.gameConfig.diceRuleSetId, "demo-barrage");
        assert.equal(repairResponse.payload.rawState.gameConfig.diceRuleSetName, "Demo Barrage");
        assert.equal(repairResponse.payload.rawState.diceRuleSetId, "demo-barrage");
      }
    );
  }
);

register(
  "admin console routes expose operational reads, maintenance validation, termination, and audit history",
  async () => {
    await withAdminApp(async ({ app, adminSessionToken }) => {
      const adminUser = await app.datastore.findUserByUsername("admin_commander");
      assert.ok(adminUser);

      const registered = await app.auth.registerPasswordUser("ops_observer", "secret123");
      assert.equal(registered.ok, true);
      const guestLogin = await app.auth.loginWithPassword("ops_observer", "secret123");
      assert.equal(guestLogin.ok, true);

      const staleLobbyResponse = await callApp(
        app,
        "POST",
        "/api/games",
        {
          name: "Broken Lobby"
        },
        authHeaders(adminSessionToken)
      );
      assert.equal(staleLobbyResponse.statusCode, 201);
      const staleLobbyId = staleLobbyResponse.payload.game.id;

      const staleLobbyRecord = await app.datastore.findGameById(staleLobbyId);
      assert.ok(staleLobbyRecord);
      staleLobbyRecord.updatedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      staleLobbyRecord.state.gameConfig = {
        ...(staleLobbyRecord.state.gameConfig || {}),
        totalPlayers: 1,
        mapId: "ghost-map",
        contentPackId: "ghost-pack",
        diceRuleSetId: "ghost-dice",
        diceRuleSetName: "Ghost Dice",
        themeId: "ghost-theme",
        pieceSkinId: "ghost-skin",
        victoryRuleSetId: "ghost-victory",
        activeModules: [{ id: "ghost.module", version: "1.0.0" }]
      };
      await app.datastore.updateGame(staleLobbyRecord);

      const activeGameResponse = await callApp(
        app,
        "POST",
        "/api/games",
        {
          name: "Live Match"
        },
        authHeaders(adminSessionToken)
      );
      assert.equal(activeGameResponse.statusCode, 201);
      const activeGameId = activeGameResponse.payload.game.id;

      const joinResponse = await callApp(
        app,
        "POST",
        "/api/join",
        {
          gameId: activeGameId
        },
        authHeaders(guestLogin.sessionToken)
      );
      assert.equal(joinResponse.statusCode, 201);

      const startResponse = await callApp(
        app,
        "POST",
        "/api/start",
        {
          gameId: activeGameId,
          playerId: activeGameResponse.payload.playerId
        },
        authHeaders(adminSessionToken)
      );
      assert.equal(startResponse.statusCode, 200);

      const activeGameRecord = await app.datastore.findGameById(activeGameId);
      assert.ok(activeGameRecord);
      activeGameRecord.state.currentTurnIndex = 99;
      await app.datastore.updateGame(activeGameRecord);

      const overviewResponse = await callApp(
        app,
        "GET",
        "/api/admin/overview",
        undefined,
        authHeaders(adminSessionToken)
      );
      assert.equal(overviewResponse.statusCode, 200);
      assert.equal(overviewResponse.payload.summary.totalUsers >= 2, true);
      assert.equal(overviewResponse.payload.summary.activeGames >= 1, true);
      assert.equal(overviewResponse.payload.summary.staleLobbies >= 1, true);
      assert.equal(overviewResponse.payload.summary.invalidGames >= 1, true);
      assert.equal(
        overviewResponse.payload.issues.some((issue: any) => issue.code === "stale-lobby"),
        true
      );

      const usersResponse = await callApp(
        app,
        "GET",
        "/api/admin/users?q=ops&role=user",
        undefined,
        authHeaders(adminSessionToken)
      );
      assert.equal(usersResponse.statusCode, 200);
      assert.equal(usersResponse.payload.filteredTotal, 1);
      assert.equal(usersResponse.payload.users[0].username, "ops_observer");

      const gamesResponse = await callApp(
        app,
        "GET",
        "/api/admin/games?status=lobby&q=Broken",
        undefined,
        authHeaders(adminSessionToken)
      );
      assert.equal(gamesResponse.statusCode, 200);
      assert.equal(gamesResponse.payload.filteredTotal, 1);
      assert.equal(gamesResponse.payload.games[0].stale, true);
      assert.equal(
        gamesResponse.payload.games[0].issues.some((issue: any) => issue.code === "missing-map"),
        true
      );

      const detailsResponse = await callApp(
        app,
        "GET",
        `/api/admin/games/${activeGameId}`,
        undefined,
        authHeaders(adminSessionToken)
      );
      assert.equal(detailsResponse.statusCode, 200);
      assert.equal(detailsResponse.payload.players.length, 2);
      assert.equal(detailsResponse.payload.rawState.currentTurnIndex, 99);

      const configResponse = await callApp(
        app,
        "GET",
        "/api/admin/config",
        undefined,
        authHeaders(adminSessionToken)
      );
      assert.equal(configResponse.statusCode, 200);
      assert.equal(typeof configResponse.payload.config.maintenance.staleLobbyDays, "number");

      const maintenanceReportResponse = await callApp(
        app,
        "GET",
        "/api/admin/maintenance",
        undefined,
        authHeaders(adminSessionToken)
      );
      assert.equal(maintenanceReportResponse.statusCode, 200);
      assert.equal(maintenanceReportResponse.payload.summary.staleLobbies >= 1, true);
      assert.equal(
        maintenanceReportResponse.payload.issues.some(
          (issue: any) => issue.code === "invalid-turn-index"
        ),
        true
      );

      const validateAllResponse = await callApp(
        app,
        "POST",
        "/api/admin/maintenance",
        {
          action: "validate-all"
        },
        authHeaders(adminSessionToken)
      );
      assert.equal(validateAllResponse.statusCode, 200);
      assert.equal(validateAllResponse.payload.audit.action, "maintenance.validate-all");

      const demoteAdminResponse = await callApp(
        app,
        "POST",
        "/api/admin/users/role",
        {
          userId: adminUser.id,
          role: "user"
        },
        authHeaders(adminSessionToken)
      );
      assert.equal(demoteAdminResponse.statusCode, 400);

      const terminateResponse = await callApp(
        app,
        "POST",
        "/api/admin/games/action",
        {
          gameId: activeGameId,
          action: "terminate-game",
          confirmation: activeGameId
        },
        authHeaders(adminSessionToken)
      );
      assert.equal(terminateResponse.statusCode, 200);
      assert.equal(terminateResponse.payload.game.phase, "finished");
      assert.equal(terminateResponse.payload.audit.action, "game.terminate-game");

      const auditResponse = await callApp(
        app,
        "GET",
        "/api/admin/audit",
        undefined,
        authHeaders(adminSessionToken)
      );
      assert.equal(auditResponse.statusCode, 200);
      const auditActions = auditResponse.payload.entries.map(
        (entry: any) => `${entry.action}:${entry.result}`
      );
      assert.equal(auditActions.includes("maintenance.validate-all:success"), true);
      assert.equal(auditActions.includes("game.terminate-game:success"), true);
      assert.equal(auditActions.includes("user.role.update:failure"), true);
    });
  }
);

register(
  "admin console direct methods aggregate issues, filters users, and enforce module safety",
  async () => {
    const actor = {
      id: "admin-1",
      username: "admin_commander",
      role: "admin"
    };
    const users = [
      {
        id: "admin-1",
        username: "admin_commander",
        role: "admin",
        createdAt: "2026-04-20T10:00:00.000Z",
        profile: {
          preferences: {
            theme: "command"
          }
        }
      },
      {
        id: "user-1",
        username: "field_scout",
        role: "user",
        createdAt: "2026-04-19T10:00:00.000Z",
        profile: {
          preferences: {
            theme: "ember"
          }
        }
      }
    ];
    const rawGames = [
      {
        id: "finished-user-win",
        name: "Finished Win",
        version: 1,
        creatorUserId: "user-1",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T12:00:00.000Z",
        state: {
          phase: "finished",
          winnerId: "p-user",
          players: [
            {
              id: "p-user",
              name: "field_scout",
              linkedUserId: "user-1"
            },
            {
              id: "p-admin",
              name: "admin_commander",
              linkedUserId: "admin-1"
            }
          ],
          territories: {
            alpha: {
              ownerId: "p-user"
            }
          },
          hands: {
            "p-user": [{ id: "card-1" }],
            "p-admin": []
          },
          gameConfig: {}
        }
      },
      {
        id: "broken-lobby",
        name: "Broken Lobby",
        version: 1,
        creatorUserId: "admin-1",
        createdAt: "2026-04-15T10:00:00.000Z",
        updatedAt: "2026-04-15T12:00:00.000Z",
        state: {
          phase: "lobby",
          players: [
            {
              id: "p-admin",
              name: "admin_commander",
              linkedUserId: "admin-1"
            },
            {
              id: "p-user",
              name: "field_scout",
              linkedUserId: "user-1"
            }
          ],
          territories: {
            alpha: {
              ownerId: "p-admin"
            },
            beta: {
              ownerId: "p-user"
            }
          },
          hands: {
            "p-admin": [{ id: "card-2" }],
            "p-user": [{ id: "card-3" }, { id: "card-4" }]
          },
          gameConfig: {
            mapId: "ghost-map",
            contentPackId: "ghost-pack",
            diceRuleSetId: "ghost-dice",
            diceRuleSetName: "Ghost Dice",
            themeId: "ghost-theme",
            pieceSkinId: "ghost-skin",
            victoryRuleSetId: "ghost-victory"
          }
        }
      },
      {
        id: "active-turn",
        name: "Turn Drift",
        version: 1,
        creatorUserId: "admin-1",
        createdAt: "2026-04-16T10:00:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z",
        state: {
          phase: "active",
          currentTurnIndex: 5,
          players: [
            {
              id: "p-admin",
              name: "admin_commander",
              linkedUserId: "admin-1"
            },
            {
              id: "p-user",
              name: "field_scout",
              linkedUserId: "user-1"
            }
          ],
          territories: {
            gamma: {
              ownerId: "p-admin"
            }
          },
          hands: {
            "p-admin": [],
            "p-user": [{ id: "card-5" }]
          },
          gameConfig: {}
        }
      },
      {
        id: "active-empty",
        name: "Ghost Match",
        version: 1,
        creatorUserId: "admin-1",
        createdAt: "2026-04-17T10:00:00.000Z",
        updatedAt: "2026-04-17T12:00:00.000Z",
        state: {
          phase: "active",
          currentTurnIndex: 0,
          players: [],
          territories: {},
          hands: {},
          gameConfig: {}
        }
      }
    ];
    const gameSummaries = [
      {
        id: "finished-user-win",
        name: "Finished Win",
        version: 1,
        phase: "finished",
        playerCount: 2,
        totalPlayers: 2,
        creatorUserId: "user-1",
        contentPackId: null,
        mapId: null,
        mapName: null,
        diceRuleSetId: null,
        activeModules: [],
        gamePresetId: null,
        contentProfileId: null,
        gameplayProfileId: null,
        uiProfileId: null,
        updatedAt: "2026-04-18T12:00:00.000Z",
        createdAt: "2026-04-18T10:00:00.000Z"
      },
      {
        id: "broken-lobby",
        name: "Broken Lobby",
        version: 1,
        phase: "lobby",
        playerCount: 3,
        totalPlayers: 2,
        creatorUserId: "admin-1",
        contentPackId: "ghost-pack",
        mapId: "ghost-map",
        mapName: "Ghost Map",
        diceRuleSetId: "ghost-dice",
        activeModules: [
          { id: "ghost.module", version: "1.0.0" },
          { id: "module.off", version: "1.0.0" }
        ],
        gamePresetId: null,
        contentProfileId: null,
        gameplayProfileId: null,
        uiProfileId: null,
        updatedAt: "2026-04-15T12:00:00.000Z",
        createdAt: "2026-04-15T10:00:00.000Z"
      },
      {
        id: "active-turn",
        name: "Turn Drift",
        version: 1,
        phase: "active",
        playerCount: 2,
        totalPlayers: 2,
        creatorUserId: "admin-1",
        contentPackId: null,
        mapId: null,
        mapName: null,
        diceRuleSetId: null,
        activeModules: [],
        gamePresetId: null,
        contentProfileId: null,
        gameplayProfileId: null,
        uiProfileId: null,
        updatedAt: "2026-04-16T12:00:00.000Z",
        createdAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: "active-empty",
        name: "Ghost Match",
        version: 1,
        phase: "active",
        playerCount: 0,
        totalPlayers: null,
        creatorUserId: "admin-1",
        contentPackId: null,
        mapId: null,
        mapName: null,
        diceRuleSetId: null,
        activeModules: [],
        gamePresetId: null,
        contentProfileId: null,
        gameplayProfileId: null,
        uiProfileId: null,
        updatedAt: "2026-04-17T12:00:00.000Z",
        createdAt: "2026-04-17T10:00:00.000Z"
      }
    ];
    const appState: Record<string, unknown> = {
      adminConsoleConfig: {
        defaults: {
          activeModuleIds: ["module.safe"],
          themeId: "command"
        },
        maintenance: {
          staleLobbyDays: 2,
          auditLogLimit: 10
        },
        updatedAt: "2026-04-22T07:00:00.000Z",
        updatedBy: actor
      },
      adminAuditLog: [
        {
          id: "audit-older",
          actorId: "admin-1",
          actorUsername: "admin_commander",
          action: "seed.audit.older",
          targetType: "config",
          targetId: "global",
          targetLabel: "Global defaults",
          result: "success",
          createdAt: "2026-04-20T10:00:00.000Z",
          details: null
        },
        {
          id: "audit-newer",
          actorId: "admin-1",
          actorUsername: "admin_commander",
          action: "seed.audit.newer",
          targetType: "config",
          targetId: "global",
          targetLabel: "Global defaults",
          result: "success",
          createdAt: "2026-04-21T10:00:00.000Z",
          details: null
        }
      ]
    };
    const roleUpdates: Array<{ username: string; role: string }> = [];

    const adminConsole = createAdminConsole({
      datastore: {
        listUsers() {
          return users;
        },
        findUserById(userId: string) {
          return users.find((user) => user.id === userId) || null;
        },
        updateUserRoleByUsername(username: string, role: string) {
          roleUpdates.push({ username, role });
          const targetUser = users.find((user) => user.username === username);
          if (targetUser) {
            targetUser.role = role;
          }
        },
        getAppState(key: string) {
          return appState[key] || null;
        },
        setAppState(key: string, value: unknown) {
          appState[key] = value;
          return value;
        }
      },
      auth: {
        publicUser(user: any) {
          if (!user) {
            return null;
          }

          return {
            id: String(user.id || ""),
            username: String(user.username || ""),
            role: user.role === "admin" ? "admin" : "user",
            hasEmail: false,
            authMethods: ["password"],
            preferences: {
              theme:
                typeof user?.profile?.preferences?.theme === "string"
                  ? user.profile.preferences.theme
                  : typeof user?.preferences?.theme === "string"
                    ? user.preferences.theme
                    : null
            }
          };
        }
      },
      gameSessions: {
        listGames() {
          return gameSummaries;
        },
        getGame(gameId: string) {
          const summary = gameSummaries.find((entry) => entry.id === gameId);
          const rawGame = rawGames.find((entry) => entry.id === gameId);
          if (!summary || !rawGame) {
            throw new Error(`Unknown game ${gameId}`);
          }

          return {
            game: JSON.parse(JSON.stringify(summary)),
            state: JSON.parse(JSON.stringify(rawGame.state))
          };
        },
        datastore: {
          listGames() {
            return rawGames;
          }
        }
      },
      loadGameContext() {
        throw new Error("loadGameContext should not be used in this direct methods test");
      },
      persistGameContext() {
        return null;
      },
      broadcastGame() {},
      createConfiguredInitialState(configInput: Record<string, unknown> = {}) {
        return {
          state: {
            gameConfig: {
              ...configInput,
              activeModules: Array.isArray(configInput.activeModuleIds)
                ? configInput.activeModuleIds.map((moduleId) => ({ id: moduleId }))
                : [],
              players: Array.isArray(configInput.players) ? configInput.players : []
            }
          },
          config: {}
        };
      },
      moduleRuntime: {
        async listInstalledModules() {
          return [
            {
              id: "module.safe",
              enabled: true,
              compatible: true
            },
            {
              id: "module.off",
              enabled: false,
              compatible: false
            }
          ];
        },
        async getEnabledModules() {
          return [
            {
              id: "module.safe",
              version: "1.0.0"
            }
          ];
        },
        findSupportedMap(mapId: string) {
          return mapId === "classic-mini" ? { id: mapId } : null;
        },
        findContentPack(contentPackId: string) {
          return contentPackId === "core" ? { id: contentPackId } : null;
        },
        findPlayerPieceSet(pieceSetId: string) {
          return pieceSetId === "classic" ? { id: pieceSetId } : null;
        },
        findDiceRuleSet(diceRuleSetId: string) {
          return diceRuleSetId === "standard" ? { id: diceRuleSetId } : null;
        },
        async resolveGamePreset() {
          return null;
        },
        async resolveGameConfigDefaults() {
          return {};
        },
        async resolveGameSelection(input: Record<string, unknown> = {}) {
          return {
            moduleSchemaVersion: 1,
            activeModules: Array.isArray(input.activeModuleIds)
              ? input.activeModuleIds.map((moduleId) => ({
                  id: moduleId,
                  version: "1.0.0"
                }))
              : [],
            contentProfileId: null,
            gameplayProfileId: null,
            uiProfileId: null
          };
        }
      }
    });

    const overview = await adminConsole.getOverview();
    assert.equal(overview.summary.totalUsers, 2);
    assert.equal(overview.summary.invalidGames >= 2, true);
    assert.equal(overview.summary.staleLobbies, 1);
    assert.equal(overview.summary.enabledModules, 1);
    assert.equal(
      overview.issues.some((issue: any) => issue.code === "missing-map"),
      true
    );
    assert.equal(
      overview.issues.some((issue: any) => issue.code === "disabled-module-reference"),
      true
    );

    const filteredUsers = await adminConsole.listUsers({
      query: "scout",
      role: "user"
    });
    assert.equal(filteredUsers.filteredTotal, 1);
    assert.equal(filteredUsers.users[0].gamesPlayed, 1);
    assert.equal(filteredUsers.users[0].wins, 1);

    await assert.rejects(
      () =>
        adminConsole.updateUserRole(actor, {
          userId: "admin-1",
          role: "user"
        }),
      /ultimo amministratore/
    );

    const promoteResponse = await adminConsole.updateUserRole(actor, {
      userId: "user-1",
      role: "admin"
    });
    assert.equal(promoteResponse.user.role, "admin");
    assert.deepEqual(roleUpdates, [
      {
        username: "field_scout",
        role: "admin"
      }
    ]);

    const lobbyGames = await adminConsole.listGames({
      status: "lobby",
      query: "Broken"
    });
    assert.equal(lobbyGames.filteredTotal, 1);
    assert.equal(lobbyGames.games[0].issueCount >= 6, true);
    assert.equal(
      lobbyGames.games[0].issues.some((issue: any) => issue.code === "orphaned-module-reference"),
      true
    );

    const gameDetail = await adminConsole.getGameDetails("active-turn");
    assert.equal(gameDetail.players.length, 2);
    assert.equal(gameDetail.players[0].territoryCount, 1);
    assert.equal(gameDetail.players[1].cardCount, 1);

    const config = await adminConsole.getConfig();
    assert.equal(config.config.defaults.activeModuleIds[0], "module.safe");
    assert.equal(config.config.updatedBy.username, "admin_commander");

    const maintenanceReport = await adminConsole.getMaintenanceReport();
    assert.equal(maintenanceReport.summary.staleLobbies, 1);
    assert.equal(maintenanceReport.summary.invalidGames >= 2, true);
    assert.equal(maintenanceReport.summary.orphanedModuleReferences, 2);

    const audit = await adminConsole.listAudit();
    assert.equal(audit.entries.length, 3);
    assert.equal(audit.entries[0].action, "user.role.update");

    await assert.rejects(
      () => adminConsole.assertModuleSafeToDisable("module.safe"),
      /still referenced/
    );
    await assert.doesNotReject(() => adminConsole.assertModuleSafeToDisable("module.off"));
  }
);

register("stale lobby cleanup skips games that become active before mutation", async () => {
  const persistedStates: Array<{ gameId: string; phase: string }> = [];
  const broadcastStates: Array<{ gameId: string; phase: string }> = [];
  const adminConsole = createAdminConsole({
    datastore: {
      listUsers() {
        return [];
      },
      findUserById() {
        return null;
      },
      updateUserRoleByUsername() {},
      getAppState(key: string) {
        if (key === "adminConsoleConfig") {
          return {
            defaults: {},
            maintenance: {
              staleLobbyDays: 1,
              auditLogLimit: 120
            }
          };
        }

        if (key === "adminAuditLog") {
          return [];
        }

        return null;
      },
      setAppState() {
        return null;
      }
    },
    auth: {
      publicUser(user: any) {
        return user;
      }
    },
    gameSessions: {
      listGames() {
        return [
          {
            id: "game-race",
            name: "Race Lobby",
            version: 1,
            phase: "lobby",
            playerCount: 1,
            updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          }
        ];
      },
      getGame() {
        return {
          game: {
            id: "game-race",
            name: "Race Lobby",
            version: 1,
            phase: "lobby",
            playerCount: 1,
            updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          },
          state: {
            phase: "lobby",
            players: [],
            territories: {},
            hands: {},
            gameConfig: {}
          }
        };
      },
      datastore: {
        listGames() {
          return [
            {
              id: "game-race",
              name: "Race Lobby",
              version: 1,
              creatorUserId: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              state: {
                phase: "lobby",
                players: [],
                territories: {},
                hands: {},
                gameConfig: {}
              }
            }
          ];
        }
      }
    },
    loadGameContext() {
      return {
        gameId: "game-race",
        gameName: "Race Lobby",
        version: 1,
        state: {
          phase: "active",
          players: [],
          territories: {},
          hands: {},
          gameConfig: {}
        }
      };
    },
    persistGameContext(gameContext: any) {
      persistedStates.push({
        gameId: gameContext.gameId,
        phase: String(gameContext.state?.phase || "")
      });
      return null;
    },
    broadcastGame(gameContext: any) {
      broadcastStates.push({
        gameId: gameContext.gameId,
        phase: String(gameContext.state?.phase || "")
      });
    },
    createConfiguredInitialState() {
      return {
        state: {
          gameConfig: {},
          contentPackId: "core",
          diceRuleSetId: "standard",
          victoryRuleSetId: "conquest",
          pieceSetId: "classic"
        },
        config: {}
      };
    },
    moduleRuntime: {
      listInstalledModules() {
        return [];
      },
      getEnabledModules() {
        return [];
      },
      findSupportedMap() {
        return null;
      },
      findContentPack() {
        return null;
      },
      findPlayerPieceSet() {
        return null;
      },
      findDiceRuleSet() {
        return null;
      },
      resolveGamePreset() {
        return null;
      },
      resolveGameConfigDefaults() {
        return {};
      },
      resolveGameSelection() {
        return {
          moduleSchemaVersion: 1,
          activeModules: [],
          contentProfileId: null,
          gameplayProfileId: null,
          uiProfileId: null
        };
      }
    }
  });

  const actionResponse = await adminConsole.runMaintenanceAction(
    {
      id: "admin-1",
      username: "admin_commander",
      role: "admin"
    },
    {
      action: "cleanup-stale-lobbies",
      confirmation: "cleanup-stale-lobbies"
    }
  );

  assert.deepEqual(actionResponse.affectedGameIds, []);
  assert.deepEqual(persistedStates, []);
  assert.deepEqual(broadcastStates, []);
});
