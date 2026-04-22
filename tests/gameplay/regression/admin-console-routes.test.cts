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
  await withAdminApp(async (context) => {
    modules.forEach((moduleEntry) => {
      const moduleRoot = path.join(context.tempRoot, "modules", moduleEntry.dir);
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

    await run(context);
  });
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
    assert.equal(createGameResponse.statusCode, 200);
    assert.equal(createGameResponse.payload.state.gameConfig.themeId, "ember");
    assert.equal(createGameResponse.payload.state.gameConfig.mapId, "middle-earth");
    assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
    assert.equal(createGameResponse.payload.state.gameConfig.victoryRuleSetId, "majority-control");
    assert.equal(createGameResponse.payload.state.gameConfig.pieceSkinId, "command-ring");
    assert.equal(createGameResponse.payload.state.gameConfig.totalPlayers, 3);
  });
});

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
    assert.equal(createGameResponse.statusCode, 200);
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

    assert.equal(createGameResponse.statusCode, 200);
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

register("admin repair preserves runtime dice rule ids while fixing the stored snapshot", async () => {
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
          kind: "hybrid",
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
  listDiceRuleSets() {
    return [
      {
        id: "demo-barrage",
        name: "Demo Barrage",
        attackerMaxDice: 4,
        defenderMaxDice: 2,
        attackerMustLeaveOneArmyBehind: true,
        defenderWinsTies: true
      }
    ];
  }
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
          diceRuleSetId: "demo-barrage"
        },
        authHeaders(adminSessionToken)
      );

      assert.equal(createGameResponse.statusCode, 200);
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
      assert.equal(repairResponse.payload.rawState.diceRuleSetName, "Demo Barrage");
      assert.equal(repairResponse.payload.rawState.diceRuleSetId, "demo-barrage");
    }
  );
});

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
