const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("../../../backend/server.cjs");

type HeaderMap = Record<string, string>;

type MockResponse = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
  writeHead(statusCode: number, nextHeaders?: HeaderMap): void;
  end(chunk?: string): void;
};

type CallAppResult = {
  statusCode: number;
  payload: any;
};

function register(name: string, fn: () => unknown | Promise<unknown>) {
  (global as typeof globalThis & { register?: (name: string, fn: () => unknown | Promise<unknown>) => void; }).register?.(name, fn);
}

function makeMockResponse(): MockResponse {
  const headers: HeaderMap = {};
  return {
    statusCode: 200,
    headers,
    body: "",
    writeHead(statusCode: number, nextHeaders: HeaderMap = {}) {
      this.statusCode = statusCode;
      Object.assign(headers, nextHeaders);
    },
    end(chunk = "") {
      this.body += chunk || "";
    }
  };
}

async function callApp(app: any, method: string, pathname: string, body?: any, headers: HeaderMap = {}): Promise<CallAppResult> {
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

async function withModuleServer(
  modules: Array<{ dir: string; manifest?: unknown; clientManifest?: unknown; rawManifest?: string; serverEntryPath?: string; serverEntrySource?: string }>,
  run: (context: {
    app: any;
    adminSessionToken: string;
    tempRoot: string;
  }) => Promise<void>
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
      fs.writeFileSync(path.join(moduleRoot, moduleEntry.serverEntryPath), moduleEntry.serverEntrySource);
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

register("module runtime scandisce moduli validi e invalidi ed espone catalogo e opzioni", async () => {
  await withModuleServer([
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
          { kind: "gameplay-hook", scope: "game", hook: "setup.profile", description: "Demo profile" }
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
  ], async ({ app, adminSessionToken }) => {
    const catalogResponse = await callApp(app, "GET", "/api/modules", undefined, authHeaders(adminSessionToken));
    assert.equal(catalogResponse.statusCode, 200);
    const modules = catalogResponse.payload.modules;
    assert.equal(Array.isArray(modules), true);
    assert.equal(modules.some((entry: any) => entry.id === "core.base" && entry.enabled), true);
    assert.equal(modules.some((entry: any) => entry.id === "demo.valid" && entry.status === "validated"), true);
    assert.equal(modules.some((entry: any) => entry.id === "broken.module" && entry.status === "error"), true);

    const enableResponse = await callApp(app, "POST", "/api/modules/demo.valid/enable", {}, authHeaders(adminSessionToken));
    assert.equal(enableResponse.statusCode, 200);
    assert.equal(enableResponse.payload.enabledModules.some((entry: any) => entry.id === "demo.valid"), true);

    const optionsResponse = await callApp(app, "GET", "/api/modules/options");
    assert.equal(optionsResponse.statusCode, 200);
    assert.equal(optionsResponse.payload.gameModules.some((entry: any) => entry.id === "demo.valid"), true);
    assert.equal(optionsResponse.payload.uiSlots.some((entry: any) => entry.itemId === "demo.valid.briefing"), true);
    assert.equal(optionsResponse.payload.gameplayProfiles.some((entry: any) => entry.id === "demo.valid.gameplay"), true);
  });
});

register("module runtime pinna activeModules nelle nuove partite e blocca il disable se il modulo e in uso", async () => {
  await withModuleServer([
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
          { kind: "gameplay-hook", scope: "game", hook: "setup.profile", description: "Locked gameplay profile" }
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
  ], async ({ app, adminSessionToken }) => {
    const enableResponse = await callApp(app, "POST", "/api/modules/demo.locked/enable", {}, authHeaders(adminSessionToken));
    assert.equal(enableResponse.statusCode, 200);

    const createGameResponse = await callApp(app, "POST", "/api/games", {
      name: "Modular Game",
      activeModuleIds: ["demo.locked"],
      contentProfileId: "demo.locked.content",
      gameplayProfileId: "demo.locked.gameplay",
      uiProfileId: "demo.locked.ui"
    }, authHeaders(adminSessionToken));

    assert.equal(createGameResponse.statusCode, 201);
    assert.equal(createGameResponse.payload.state.gameConfig.moduleSchemaVersion, 1);
    assert.equal(createGameResponse.payload.state.gameConfig.activeModules.some((entry: any) => entry.id === "core.base"), true);
    assert.equal(createGameResponse.payload.state.gameConfig.activeModules.some((entry: any) => entry.id === "demo.locked"), true);
    assert.equal(createGameResponse.payload.state.gameConfig.contentProfileId, "demo.locked.content");
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayProfileId, "demo.locked.gameplay");
    assert.equal(createGameResponse.payload.state.gameConfig.uiProfileId, "demo.locked.ui");

    const gameListResponse = await callApp(app, "GET", "/api/games");
    assert.equal(gameListResponse.statusCode, 200);
    const listedGame = gameListResponse.payload.games.find((entry: any) => entry.id === createGameResponse.payload.game.id);
    assert.equal(Boolean(listedGame), true);
    assert.equal(listedGame.activeModules.some((entry: any) => entry.id === "demo.locked"), true);
    assert.equal(listedGame.contentProfileId, "demo.locked.content");
    assert.equal(listedGame.gameplayProfileId, "demo.locked.gameplay");
    assert.equal(listedGame.uiProfileId, "demo.locked.ui");

    const disableResponse = await callApp(app, "POST", "/api/modules/demo.locked/disable", {}, authHeaders(adminSessionToken));
    assert.equal(disableResponse.statusCode, 409);
  });
});

register("module runtime protegge il catalogo admin da accessi non autorizzati", async () => {
  await withModuleServer([], async ({ app }) => {
    const anonymousResponse = await callApp(app, "GET", "/api/modules");
    assert.equal(anonymousResponse.statusCode, 401);

    const registered = await app.auth.registerPasswordUser("module_user", "secret123");
    assert.equal(registered.ok, true);
    const login = await app.auth.loginWithPassword("module_user", "secret123");
    assert.equal(login.ok, true);

    const nonAdminResponse = await callApp(app, "GET", "/api/modules", undefined, authHeaders(login.sessionToken));
    assert.equal(nonAdminResponse.statusCode, 403);
  });
});

register("module runtime filtra il catalogo setup e blocca contenuti non esposti dai moduli attivi", async () => {
  await withModuleServer([
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
  ], async ({ app, adminSessionToken }) => {
    const optionsResponse = await callApp(app, "GET", "/api/game/options");
    assert.equal(optionsResponse.statusCode, 200);
    assert.deepEqual(optionsResponse.payload.maps.map((entry: any) => entry.id), ["classic-mini"]);
    assert.deepEqual(optionsResponse.payload.diceRuleSets.map((entry: any) => entry.id), ["standard"]);
    assert.deepEqual(optionsResponse.payload.victoryRuleSets.map((entry: any) => entry.id), ["conquest"]);
    assert.deepEqual(optionsResponse.payload.themes.map((entry: any) => entry.id), ["command"]);
    assert.deepEqual(optionsResponse.payload.pieceSkins.map((entry: any) => entry.id), ["classic-color"]);
    assert.deepEqual(optionsResponse.payload.playerPieceSets.map((entry: any) => entry.id), ["classic"]);
    assert.deepEqual(optionsResponse.payload.contentPacks.map((entry: any) => entry.id), ["core"]);

    const moduleOptionsResponse = await callApp(app, "GET", "/api/modules/options");
    assert.equal(moduleOptionsResponse.statusCode, 200);
    assert.deepEqual(moduleOptionsResponse.payload.content.mapIds, ["classic-mini"]);
    assert.deepEqual(moduleOptionsResponse.payload.content.siteThemeIds, ["command"]);

    const invalidCreateResponse = await callApp(app, "POST", "/api/games", {
      name: "Restricted Catalog Game",
      mapId: "world-classic"
    }, authHeaders(adminSessionToken));
    assert.equal(invalidCreateResponse.statusCode, 400);
    assert.equal(String(invalidCreateResponse.payload.error || invalidCreateResponse.payload.message).includes("Selected map"), true);
  });
});

register("module runtime applica defaults setup dai profili server-side del modulo selezionato", async () => {
  await withModuleServer([
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
          { kind: "gameplay-hook", scope: "game", hook: "setup.profile", description: "Setup defaults profile" }
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
          majorityControlThresholdPercent: 60,
          conquestMinimumArmies: 2,
          fortifyMinimumArmies: 2,
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
  ], async ({ app, adminSessionToken }) => {
    const enableResponse = await callApp(app, "POST", "/api/modules/demo.defaults/enable", {}, authHeaders(adminSessionToken));
    assert.equal(enableResponse.statusCode, 200);

    const createGameResponse = await callApp(app, "POST", "/api/games", {
      name: "Profile Defaults Game",
      activeModuleIds: ["demo.defaults"],
      contentProfileId: "demo.defaults.content",
      gameplayProfileId: "demo.defaults.gameplay",
      uiProfileId: "demo.defaults.ui"
    }, authHeaders(adminSessionToken));

    assert.equal(createGameResponse.statusCode, 201);
    assert.equal(createGameResponse.payload.state.gameConfig.mapId, "world-classic");
    assert.equal(createGameResponse.payload.state.gameConfig.ruleSetId, "classic-defense-3");
    assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
    assert.equal(createGameResponse.payload.state.gameConfig.victoryRuleSetId, "majority-control");
    assert.equal(createGameResponse.payload.state.gameConfig.themeId, "ember");
    assert.equal(createGameResponse.payload.state.gameConfig.pieceSkinId, "command-ring");
    assert.equal(createGameResponse.payload.state.gameConfig.scenarioSetup.territoryBonuses[0].territoryId, "aurora");
    assert.equal(createGameResponse.payload.state.gameConfig.scenarioSetup.logMessage, "Scenario defaults applied.");
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayEffects.attackMinimumArmies, 3);
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayEffects.attackLimitPerTurn, 2);
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayEffects.majorityControlThresholdPercent, 60);
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayEffects.conquestMinimumArmies, 2);
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayEffects.fortifyMinimumArmies, 2);
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayEffects.reinforcementAdjustments[0].flatBonus, 5);
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayEffects.reinforcementAdjustments[0].minimumTotal, 8);

    const explicitOverrideResponse = await callApp(app, "POST", "/api/games", {
      name: "Profile Defaults Override",
      activeModuleIds: ["demo.defaults"],
      contentProfileId: "demo.defaults.content",
      gameplayProfileId: "demo.defaults.gameplay",
      uiProfileId: "demo.defaults.ui",
      mapId: "classic-mini",
      themeId: "command",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "human" }]
    }, authHeaders(adminSessionToken));

    assert.equal(explicitOverrideResponse.statusCode, 201);
    assert.equal(explicitOverrideResponse.payload.state.gameConfig.mapId, "classic-mini");
    assert.equal(explicitOverrideResponse.payload.state.gameConfig.themeId, "command");
    assert.equal(explicitOverrideResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
    assert.equal(explicitOverrideResponse.payload.state.gameConfig.scenarioSetup.logMessage, "Scenario defaults applied.");
    assert.equal(explicitOverrideResponse.payload.state.gameConfig.gameplayEffects.reinforcementAdjustments[0].label, "Supply lines");

    const secondRegistered = await app.auth.registerPasswordUser("module_guest", "secret123");
    assert.equal(secondRegistered.ok, true);
    const secondLogin = await app.auth.loginWithPassword("module_guest", "secret123");
    assert.equal(secondLogin.ok, true);

    const joinResponse = await callApp(app, "POST", "/api/join", {
      gameId: explicitOverrideResponse.payload.game.id
    }, authHeaders(secondLogin.sessionToken));

    assert.equal(joinResponse.statusCode, 201);
    assert.equal(joinResponse.payload.state.players.length, 2);

    const startResponse = await callApp(app, "POST", "/api/start", {
      gameId: explicitOverrideResponse.payload.game.id,
      playerId: explicitOverrideResponse.payload.playerId
    }, authHeaders(adminSessionToken));

    assert.equal(startResponse.statusCode, 200);
    assert.equal(startResponse.payload.state.reinforcementPool >= 8, true);
    assert.equal(startResponse.payload.state.map.some((entry: any) => entry.id === "aurora" && entry.armies === 2), true);
  });
});

register("module runtime espone e risolve game preset modulari nel setup partita", async () => {
  await withModuleServer([
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
          { kind: "gameplay-hook", scope: "game", hook: "setup.profile", description: "Preset setup profile" }
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
  ], async ({ app, adminSessionToken }) => {
    const enableResponse = await callApp(app, "POST", "/api/modules/demo.presets/enable", {}, authHeaders(adminSessionToken));
    assert.equal(enableResponse.statusCode, 200);

    const optionsResponse = await callApp(app, "GET", "/api/game/options");
    assert.equal(optionsResponse.statusCode, 200);
    assert.equal(optionsResponse.payload.gamePresets.some((entry: any) => entry.id === "demo.presets.command-preset"), true);

    const createGameResponse = await callApp(app, "POST", "/api/games", {
      name: "Preset Game",
      gamePresetId: "demo.presets.command-preset",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    }, authHeaders(adminSessionToken));

    assert.equal(createGameResponse.statusCode, 201);
    assert.equal(createGameResponse.payload.state.gameConfig.gamePresetId, "demo.presets.command-preset");
    assert.equal(createGameResponse.payload.state.gameConfig.mapId, "classic-mini");
    assert.equal(createGameResponse.payload.state.gameConfig.themeId, "command");
    assert.equal(createGameResponse.payload.state.gameConfig.diceRuleSetId, "defense-3");
    assert.equal(createGameResponse.payload.state.gameConfig.pieceSkinId, "command-ring");
    assert.equal(createGameResponse.payload.state.gameConfig.activeModules.some((entry: any) => entry.id === "demo.presets"), true);
    assert.equal(createGameResponse.payload.state.gameConfig.contentProfileId, "demo.presets.content");
    assert.equal(createGameResponse.payload.state.gameConfig.gameplayProfileId, "demo.presets.gameplay");
    assert.equal(createGameResponse.payload.state.gameConfig.uiProfileId, "demo.presets.ui");

    const gameListResponse = await callApp(app, "GET", "/api/games");
    assert.equal(gameListResponse.statusCode, 200);
    const listedGame = gameListResponse.payload.games.find((entry: any) => entry.id === createGameResponse.payload.game.id);
    assert.equal(Boolean(listedGame), true);
    assert.equal(listedGame.gamePresetId, "demo.presets.command-preset");
    assert.equal(listedGame.activeModules.some((entry: any) => entry.id === "demo.presets"), true);
    assert.equal(listedGame.contentProfileId, "demo.presets.content");
    assert.equal(listedGame.gameplayProfileId, "demo.presets.gameplay");
    assert.equal(listedGame.uiProfileId, "demo.presets.ui");
  });
});
