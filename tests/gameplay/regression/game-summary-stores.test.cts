const assert = require("node:assert/strict");
const { createGameSessionStore } = require("../../../backend/game-session-store.cjs");
const { createPlayerProfileStore } = require("../../../backend/player-profile-store.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register(
  "game session summaries prefer stored map names and fall back to injected resolution",
  async () => {
    const gameSessions = createGameSessionStore({
      datastore: {
        listGames() {
          return [
            {
              id: "resolved-map",
              name: "Resolved Map Game",
              version: 2,
              creatorUserId: "u-1",
              state: {
                phase: "active",
                players: [{ id: "u-1", name: "commander" }],
                gameConfig: {
                  mapId: "world-classic",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              },
              createdAt: "2026-04-21T16:00:00.000Z",
              updatedAt: "2026-04-21T16:00:00.000Z"
            },
            {
              id: "stored-name",
              name: "Stored Name Game",
              version: 3,
              creatorUserId: "u-2",
              state: {
                phase: "lobby",
                players: [{ id: "u-2", name: "archivist" }],
                gameConfig: {
                  mapId: "middle-earth",
                  mapName: "Archived World",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              },
              createdAt: "2026-04-21T16:05:00.000Z",
              updatedAt: "2026-04-21T16:05:00.000Z"
            },
            {
              id: "missing-map",
              name: "Missing Map Game",
              version: 4,
              creatorUserId: "u-3",
              state: {
                phase: "active",
                players: [{ id: "u-3", name: "archivist" }],
                gameConfig: {
                  mapId: "orphaned-module-map",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              },
              createdAt: "2026-04-21T16:06:00.000Z",
              updatedAt: "2026-04-21T16:06:00.000Z"
            }
          ];
        },
        createGame(entry: unknown) {
          return entry;
        },
        setActiveGameId() {},
        findGameById() {
          return null;
        },
        getActiveGameId() {
          return null;
        },
        updateGame(entry: unknown) {
          return entry;
        }
      },
      resolveMapName: (mapId: string | null | undefined) =>
        mapId === "world-classic"
          ? "Runtime Outpost"
          : mapId === "middle-earth"
            ? "Current World"
            : null
    });

    const games = await gameSessions.listGames();
    const resolvedMapGame = games.find((entry: { id: string }) => entry.id === "resolved-map");
    const storedNameGame = games.find((entry: { id: string }) => entry.id === "stored-name");
    const missingMapGame = games.find((entry: { id: string }) => entry.id === "missing-map");

    assert.ok(resolvedMapGame);
    assert.ok(storedNameGame);
    assert.ok(missingMapGame);
    assert.equal(resolvedMapGame.mapName, "Runtime Outpost");
    assert.equal(storedNameGame.mapName, "Archived World");
    assert.equal(missingMapGame.mapName, "orphaned-module-map");
  }
);

register(
  "player profile summaries prefer stored map names and fall back to injected resolution",
  async () => {
    const playerProfiles = createPlayerProfileStore({
      datastore: {
        listGames() {
          return [
            {
              id: "resolved-map",
              name: "Resolved Map Game",
              updatedAt: "2026-04-21T16:00:00.000Z",
              state: {
                phase: "active",
                currentTurnIndex: 0,
                players: [{ id: "p-1", name: "commander", surrendered: false }],
                territories: {},
                hands: { "p-1": [] },
                gameConfig: {
                  mapId: "world-classic",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              }
            },
            {
              id: "stored-name",
              name: "Stored Name Game",
              updatedAt: "2026-04-21T16:05:00.000Z",
              state: {
                phase: "lobby",
                currentTurnIndex: 0,
                players: [{ id: "p-1", name: "commander", surrendered: false }],
                territories: {},
                hands: { "p-1": [] },
                gameConfig: {
                  mapId: "middle-earth",
                  mapName: "Archived World",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              }
            },
            {
              id: "missing-map",
              name: "Missing Map Game",
              updatedAt: "2026-04-21T16:06:00.000Z",
              state: {
                phase: "active",
                currentTurnIndex: 0,
                players: [{ id: "p-1", name: "commander", surrendered: false }],
                territories: {},
                hands: { "p-1": [] },
                gameConfig: {
                  mapId: "orphaned-module-map",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              }
            }
          ];
        }
      },
      resolveMapName: (mapId: string | null | undefined) =>
        mapId === "world-classic"
          ? "Runtime Outpost"
          : mapId === "middle-earth"
            ? "Current World"
            : null
    });

    const profile = await playerProfiles.getPlayerProfile("commander");
    const resolvedMapGame = profile.participatingGames.find(
      (entry: { id: string }) => entry.id === "resolved-map"
    );
    const storedNameGame = profile.participatingGames.find(
      (entry: { id: string }) => entry.id === "stored-name"
    );
    const missingMapGame = profile.participatingGames.find(
      (entry: { id: string }) => entry.id === "missing-map"
    );

    assert.ok(resolvedMapGame);
    assert.ok(storedNameGame);
    assert.ok(missingMapGame);
    assert.equal(resolvedMapGame.mapName, "Runtime Outpost");
    assert.equal(storedNameGame.mapName, "Archived World");
    assert.equal(missingMapGame.mapName, "orphaned-module-map");
  }
);

register(
  "player profile summaries expose modular metadata from normalized gameConfig",
  async () => {
    const playerProfiles = createPlayerProfileStore({
      datastore: {
        listGames() {
          return [
            {
              id: "modular-profile-game",
              name: "Modular Profile Game",
              updatedAt: "2026-04-21T16:10:00.000Z",
              state: {
                phase: "active",
                turnPhase: "attack",
                currentTurnIndex: 0,
                players: [{ id: "p-1", name: "commander", surrendered: false }],
                territories: {},
                hands: { "p-1": [] },
                gameConfig: {
                  mapId: "world-classic",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }],
                  activeModules: [
                    { id: "core.base", version: "1.0.0" },
                    { id: "demo.command-center", version: "1.0.0" },
                    { id: "broken-only-id" }
                  ],
                  gamePresetId: "demo.command-center.command-ops",
                  contentProfileId: "demo.command-center.content",
                  gameplayProfileId: "demo.command-center.gameplay",
                  uiProfileId: "demo.command-center.ui"
                }
              }
            }
          ];
        }
      }
    });

    const profile = await playerProfiles.getPlayerProfile("commander");
    const modularGame = profile.participatingGames.find(
      (entry: { id: string }) => entry.id === "modular-profile-game"
    );

    assert.ok(modularGame);
    assert.deepEqual(modularGame.activeModules, [
      { id: "core.base", version: "1.0.0" },
      { id: "demo.command-center", version: "1.0.0" }
    ]);
    assert.equal(modularGame.gamePresetId, "demo.command-center.command-ops");
    assert.equal(modularGame.contentProfileId, "demo.command-center.content");
    assert.equal(modularGame.gameplayProfileId, "demo.command-center.gameplay");
    assert.equal(modularGame.uiProfileId, "demo.command-center.ui");
  }
);

register(
  "game session store defaults to built-in map labels without a custom resolver",
  async () => {
    const gameSessions = createGameSessionStore({
      datastore: {
        listGames() {
          return [
            {
              id: "builtin-map",
              name: "Built-in Map Game",
              version: 2,
              creatorUserId: "u-1",
              state: {
                phase: "active",
                players: [{ id: "u-1", name: "commander" }],
                gameConfig: {
                  mapId: "world-classic",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              },
              createdAt: "2026-04-21T19:45:00.000Z",
              updatedAt: "2026-04-21T19:45:00.000Z"
            },
            {
              id: "missing-map",
              name: "Missing Map Game",
              version: 3,
              creatorUserId: "u-2",
              state: {
                phase: "active",
                players: [{ id: "u-2", name: "archivist" }],
                gameConfig: {
                  mapId: "orphaned-module-map",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              },
              createdAt: "2026-04-21T19:46:00.000Z",
              updatedAt: "2026-04-21T19:46:00.000Z"
            }
          ];
        },
        createGame(entry: unknown) {
          return entry;
        },
        setActiveGameId() {},
        findGameById() {
          return null;
        },
        getActiveGameId() {
          return null;
        },
        updateGame(entry: unknown) {
          return entry;
        }
      }
    });

    const games = await gameSessions.listGames();
    const builtinMapGame = games.find((entry: { id: string }) => entry.id === "builtin-map");
    const missingMapGame = games.find((entry: { id: string }) => entry.id === "missing-map");

    assert.ok(builtinMapGame);
    assert.ok(missingMapGame);
    assert.equal(builtinMapGame.mapName, "World Classic");
    assert.equal(missingMapGame.mapName, "orphaned-module-map");
  }
);

register(
  "player profile store defaults to built-in map labels without a custom resolver",
  async () => {
    const playerProfiles = createPlayerProfileStore({
      datastore: {
        listGames() {
          return [
            {
              id: "builtin-map",
              name: "Built-in Map Game",
              updatedAt: "2026-04-21T19:45:00.000Z",
              state: {
                phase: "active",
                currentTurnIndex: 0,
                players: [{ id: "p-1", name: "commander", surrendered: false }],
                territories: {},
                hands: { "p-1": [] },
                gameConfig: {
                  mapId: "world-classic",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              }
            },
            {
              id: "missing-map",
              name: "Missing Map Game",
              updatedAt: "2026-04-21T19:46:00.000Z",
              state: {
                phase: "active",
                currentTurnIndex: 0,
                players: [{ id: "p-1", name: "commander", surrendered: false }],
                territories: {},
                hands: { "p-1": [] },
                gameConfig: {
                  mapId: "orphaned-module-map",
                  totalPlayers: 2,
                  players: [{ type: "human" }, { type: "ai" }]
                }
              }
            }
          ];
        }
      }
    });

    const profile = await playerProfiles.getPlayerProfile("commander");
    const builtinMapGame = profile.participatingGames.find(
      (entry: { id: string }) => entry.id === "builtin-map"
    );
    const missingMapGame = profile.participatingGames.find(
      (entry: { id: string }) => entry.id === "missing-map"
    );

    assert.ok(builtinMapGame);
    assert.ok(missingMapGame);
    assert.equal(builtinMapGame.mapName, "World Classic");
    assert.equal(missingMapGame.mapName, "orphaned-module-map");
  }
);

register("game session store preserves runtime setup ids while rehydrating state", async () => {
  const games: any[] = [];
  let activeGameId: string | null = null;

  const gameSessions = createGameSessionStore({
    datastore: {
      listGames() {
        return games;
      },
      createGame(entry: any) {
        games.push(entry);
        return entry;
      },
      setActiveGameId(gameId: string) {
        activeGameId = gameId;
      },
      findGameById(gameId: string) {
        return games.find((entry) => entry.id === gameId) || null;
      },
      getActiveGameId() {
        return activeGameId;
      },
      updateGame(entry: any) {
        const index = games.findIndex((candidate) => candidate.id === entry.id);
        if (index >= 0) {
          games[index] = entry;
        }
        return entry;
      }
    }
  });

  const created = await gameSessions.createGame(
    {
      phase: "lobby",
      turnPhase: "reinforcement",
      currentTurnIndex: 0,
      players: [{ id: "p-1", name: "commander", surrendered: false }],
      territories: {},
      hands: { "p-1": [] },
      mapId: "classic-mini",
      mapName: "Classic Mini",
      diceRuleSetId: "standard",
      contentPackId: "core",
      victoryRuleSetId: "conquest",
      pieceSetId: "classic",
      gameConfig: {
        ruleSetId: "runtime.classic",
        ruleSetName: "Runtime Classic",
        contentPackId: "core",
        pieceSetId: "classic",
        mapId: "classic-mini",
        mapName: "Classic Mini",
        diceRuleSetId: "standard",
        diceRuleSetName: "Standard",
        diceRuleSetAttackerMaxDice: 3,
        diceRuleSetDefenderMaxDice: 2,
        diceRuleSetAttackerMustLeaveOneArmyBehind: true,
        diceRuleSetDefenderWinsTies: true,
        victoryRuleSetId: "runtime-victory",
        themeId: "runtime-theme",
        pieceSkinId: "runtime-skin",
        totalPlayers: 2,
        players: [{ type: "human" }, { type: "ai" }]
      }
    },
    { name: "Runtime Config Game" }
  );

  assert.equal(created.state.gameConfig.ruleSetId, "runtime.classic");
  assert.equal(created.state.gameConfig.victoryRuleSetId, "runtime-victory");
  assert.equal(created.state.gameConfig.themeId, "runtime-theme");
  assert.equal(created.state.gameConfig.pieceSkinId, "runtime-skin");

  const loaded = await gameSessions.getGame(created.game.id);
  assert.equal(loaded.state.gameConfig.ruleSetId, "runtime.classic");
  assert.equal(loaded.state.gameConfig.victoryRuleSetId, "runtime-victory");
  assert.equal(loaded.state.gameConfig.themeId, "runtime-theme");
  assert.equal(loaded.state.gameConfig.pieceSkinId, "runtime-skin");

  await gameSessions.saveGame(created.game.id, loaded.state, loaded.game.version);
  const reopened = await gameSessions.openGame(created.game.id);

  assert.equal(reopened.state.gameConfig.ruleSetId, "runtime.classic");
  assert.equal(reopened.state.gameConfig.victoryRuleSetId, "runtime-victory");
  assert.equal(reopened.state.gameConfig.themeId, "runtime-theme");
  assert.equal(reopened.state.gameConfig.pieceSkinId, "runtime-skin");
});

register(
  "game session store preserves modular scenario and gameplay setup across round trips",
  async () => {
    const games: any[] = [];
    let activeGameId: string | null = null;
    const expectedScenarioSetup = {
      territoryBonuses: [{ territoryId: "alaska", bonusArmies: 2 }],
      logMessage: "Scenario runtime applied."
    };
    const expectedGameplayEffects = {
      attackMinimumArmies: 4,
      attackLimitPerTurn: 2,
      minimumAttacksPerTurn: 1,
      conquestMinimumArmies: 3,
      fortifyMinimumArmies: 2,
      requiredFortifyWhenAvailable: true,
      reinforcementAdjustments: [{ label: "Harsh winter", flatBonus: 1, minimumTotal: 4 }]
    };

    const gameSessions = createGameSessionStore({
      datastore: {
        listGames() {
          return games;
        },
        createGame(entry: any) {
          games.push(entry);
          return entry;
        },
        setActiveGameId(gameId: string) {
          activeGameId = gameId;
        },
        findGameById(gameId: string) {
          return games.find((entry) => entry.id === gameId) || null;
        },
        getActiveGameId() {
          return activeGameId;
        },
        updateGame(entry: any) {
          const index = games.findIndex((candidate) => candidate.id === entry.id);
          if (index >= 0) {
            games[index] = entry;
          }
          return entry;
        }
      }
    });

    const created = await gameSessions.createGame(
      {
        phase: "lobby",
        turnPhase: "reinforcement",
        currentTurnIndex: 0,
        players: [{ id: "p-1", name: "commander", surrendered: false }],
        territories: {},
        hands: { "p-1": [] },
        mapId: "classic-mini",
        mapName: "Classic Mini",
        diceRuleSetId: "standard",
        gameConfig: {
          ruleSetId: "runtime.classic",
          ruleSetName: "Runtime Classic",
          mapId: "classic-mini",
          mapName: "Classic Mini",
          diceRuleSetId: "standard",
          victoryRuleSetId: "runtime-victory",
          themeId: "runtime-theme",
          pieceSkinId: "runtime-skin",
          gameplayEffects: expectedGameplayEffects,
          scenarioSetup: expectedScenarioSetup,
          turnTimeoutHours: 24,
          totalPlayers: 2,
          players: [{ type: "human" }, { type: "ai" }]
        }
      },
      { name: "Runtime Scenario Game" }
    );

    assert.deepEqual(created.state.gameConfig.scenarioSetup, expectedScenarioSetup);
    assert.deepEqual(created.state.gameConfig.gameplayEffects, expectedGameplayEffects);
    assert.equal(created.state.gameConfig.turnTimeoutHours, 24);

    const loaded = await gameSessions.getGame(created.game.id);
    assert.deepEqual(loaded.state.gameConfig.scenarioSetup, expectedScenarioSetup);
    assert.deepEqual(loaded.state.gameConfig.gameplayEffects, expectedGameplayEffects);
    assert.equal(loaded.state.gameConfig.turnTimeoutHours, 24);

    await gameSessions.saveGame(created.game.id, loaded.state, loaded.game.version);
    const reopened = await gameSessions.openGame(created.game.id);

    assert.deepEqual(reopened.state.gameConfig.scenarioSetup, expectedScenarioSetup);
    assert.deepEqual(reopened.state.gameConfig.gameplayEffects, expectedGameplayEffects);
    assert.equal(reopened.state.gameConfig.turnTimeoutHours, 24);
  }
);

register("game session store rehydrates legacy root setup fields into gameConfig", async () => {
  const games: any[] = [];
  let activeGameId: string | null = null;

  const gameSessions = createGameSessionStore({
    datastore: {
      listGames() {
        return games;
      },
      createGame(entry: any) {
        games.push(entry);
        return entry;
      },
      setActiveGameId(gameId: string) {
        activeGameId = gameId;
      },
      findGameById(gameId: string) {
        return games.find((entry) => entry.id === gameId) || null;
      },
      getActiveGameId() {
        return activeGameId;
      },
      updateGame(entry: any) {
        const index = games.findIndex((candidate) => candidate.id === entry.id);
        if (index >= 0) {
          games[index] = entry;
        }
        return entry;
      }
    }
  });

  const created = await gameSessions.createGame(
    {
      phase: "lobby",
      turnPhase: "reinforcement",
      currentTurnIndex: 0,
      players: [{ id: "p-1", name: "commander", surrendered: false }],
      territories: {},
      hands: { "p-1": [] },
      mapId: "classic-mini",
      mapName: "Classic Mini",
      diceRuleSetId: "standard",
      contentPackId: "runtime-pack",
      victoryRuleSetId: "runtime-victory",
      pieceSetId: "runtime-piece-set"
    },
    { name: "Legacy Root Setup Game" }
  );

  assert.equal(created.state.gameConfig.contentPackId, "runtime-pack");
  assert.equal(created.state.gameConfig.victoryRuleSetId, "runtime-victory");
  assert.equal(created.state.gameConfig.pieceSetId, "runtime-piece-set");

  const loaded = await gameSessions.getGame(created.game.id);
  assert.equal(loaded.state.gameConfig.contentPackId, "runtime-pack");
  assert.equal(loaded.state.gameConfig.victoryRuleSetId, "runtime-victory");
  assert.equal(loaded.state.gameConfig.pieceSetId, "runtime-piece-set");
});

register(
  "game session store keeps persisted custom map ids and labels in sync during normalization",
  async () => {
    const games = [
      {
        id: "root-custom-map",
        name: "Root Custom Map Game",
        version: 1,
        creatorUserId: "u-1",
        state: {
          phase: "lobby",
          turnPhase: "reinforcement",
          currentTurnIndex: 0,
          players: [{ id: "p-1", name: "commander", surrendered: false }],
          territories: {},
          hands: { "p-1": [] },
          mapId: "orphaned-module-map",
          diceRuleSetId: "standard"
        },
        createdAt: "2026-04-21T20:35:00.000Z",
        updatedAt: "2026-04-21T20:35:00.000Z"
      },
      {
        id: "config-custom-map",
        name: "Config Custom Map Game",
        version: 1,
        creatorUserId: "u-2",
        state: {
          phase: "lobby",
          turnPhase: "reinforcement",
          currentTurnIndex: 0,
          players: [{ id: "p-2", name: "strategist", surrendered: false }],
          territories: {},
          hands: { "p-2": [] },
          diceRuleSetId: "standard",
          gameConfig: {
            mapId: "orphaned-module-map",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "ai" }]
          }
        },
        createdAt: "2026-04-21T20:36:00.000Z",
        updatedAt: "2026-04-21T20:36:00.000Z"
      }
    ];

    const gameSessions = createGameSessionStore({
      datastore: {
        listGames() {
          return games;
        },
        createGame(entry: any) {
          return entry;
        },
        setActiveGameId() {},
        findGameById(gameId: string) {
          return games.find((entry) => entry.id === gameId) || null;
        },
        getActiveGameId() {
          return null;
        },
        updateGame(entry: any) {
          return entry;
        }
      }
    });

    const rootCustomMap = await gameSessions.getGame("root-custom-map");
    const configCustomMap = await gameSessions.getGame("config-custom-map");

    assert.equal(rootCustomMap.state.mapId, "orphaned-module-map");
    assert.equal(rootCustomMap.state.mapName, null);
    assert.equal(rootCustomMap.state.gameConfig.mapId, "orphaned-module-map");
    assert.equal(rootCustomMap.state.gameConfig.mapName, null);
    assert.equal(configCustomMap.state.mapId, "orphaned-module-map");
    assert.equal(configCustomMap.state.mapName, null);
    assert.equal(configCustomMap.state.gameConfig.mapId, "orphaned-module-map");
    assert.equal(configCustomMap.state.gameConfig.mapName, null);
  }
);

register(
  "game session summaries still use runtime map resolvers after saving custom maps without labels",
  async () => {
    const games: any[] = [
      {
        id: "runtime-custom-map",
        name: "Runtime Custom Map Game",
        version: 1,
        creatorUserId: "u-1",
        state: {
          phase: "lobby",
          turnPhase: "reinforcement",
          currentTurnIndex: 0,
          players: [{ id: "p-1", name: "commander", surrendered: false }],
          territories: {},
          hands: { "p-1": [] },
          mapId: "runtime-module-map",
          diceRuleSetId: "standard",
          gameConfig: {
            mapId: "runtime-module-map",
            totalPlayers: 2,
            players: [{ type: "human" }, { type: "ai" }]
          }
        },
        createdAt: "2026-04-21T20:45:00.000Z",
        updatedAt: "2026-04-21T20:45:00.000Z"
      }
    ];

    const gameSessions = createGameSessionStore({
      datastore: {
        listGames() {
          return games;
        },
        createGame(entry: any) {
          return entry;
        },
        setActiveGameId() {},
        findGameById(gameId: string) {
          return games.find((entry) => entry.id === gameId) || null;
        },
        getActiveGameId() {
          return null;
        },
        updateGame(entry: any) {
          const index = games.findIndex((candidate) => candidate.id === entry.id);
          if (index >= 0) {
            games[index] = entry;
          }
          return entry;
        }
      },
      resolveMapName: (mapId: string | null | undefined) =>
        mapId === "runtime-module-map" ? "Runtime Frontier" : null
    });

    const loaded = await gameSessions.getGame("runtime-custom-map");
    assert.equal(loaded.state.mapId, "runtime-module-map");
    assert.equal(loaded.state.mapName, null);
    assert.equal(loaded.state.gameConfig.mapId, "runtime-module-map");
    assert.equal(loaded.state.gameConfig.mapName, null);

    await gameSessions.saveGame("runtime-custom-map", loaded.state, loaded.game.version);
    const summaries = await gameSessions.listGames();
    const runtimeCustomMap = summaries.find(
      (entry: { id: string }) => entry.id === "runtime-custom-map"
    );

    assert.ok(runtimeCustomMap);
    assert.equal(runtimeCustomMap.mapName, "Runtime Frontier");
  }
);

register("game session store validates creation inputs and normalizes fallback names", async () => {
  const games: any[] = [];
  const gameSessions = createGameSessionStore({
    datastore: {
      listGames() {
        return games;
      },
      createGame(entry: any) {
        games.push(entry);
        return entry;
      },
      setActiveGameId() {},
      findGameById(gameId: string) {
        return games.find((entry) => entry.id === gameId) || null;
      },
      getActiveGameId() {
        return null;
      },
      updateGame(entry: any) {
        return entry;
      }
    }
  });

  assert.throws(() => gameSessions.createGame(null as any), /stato iniziale valido/);
  assert.throws(
    () => gameSessions.createGame({ phase: "lobby", players: [] }, { name: "   " }),
    /nome della partita non puo essere vuoto/
  );
  assert.throws(
    () => gameSessions.createGame({ phase: "lobby", players: [] }, { name: "Risk <script>" }),
    /caratteri non consentiti/
  );

  const created = await gameSessions.createGame(
    {
      phase: "lobby",
      players: [],
      territories: {},
      hands: {}
    },
    { name: null, creatorUserId: "" }
  );

  assert.equal(created.game.name, "Partita 1");
  assert.equal(created.game.creatorUserId, null);
  assert.equal(created.game.version, 1);
  assert.equal(games.length, 1);
});

register("game session store selects active games and surfaces missing-id errors", async () => {
  const games = [
    {
      id: "fallback-game",
      name: "Fallback Game",
      version: 1,
      creatorUserId: "u-1",
      state: { phase: "lobby", players: [] },
      createdAt: "2026-04-22T10:00:00.000Z",
      updatedAt: "2026-04-22T10:00:00.000Z"
    },
    {
      id: "preferred-game",
      name: "Preferred Game",
      version: 2,
      creatorUserId: "u-2",
      state: { phase: "active", players: [] },
      createdAt: "2026-04-22T11:00:00.000Z",
      updatedAt: "2026-04-22T11:00:00.000Z"
    }
  ];
  let activeGameId: string | null = "missing-game";

  const gameSessions = createGameSessionStore({
    datastore: {
      listGames() {
        return games;
      },
      createGame(entry: any) {
        games.push(entry);
        return entry;
      },
      setActiveGameId(gameId: string) {
        activeGameId = gameId;
      },
      findGameById(gameId: string) {
        return games.find((entry) => entry.id === gameId) || null;
      },
      getActiveGameId() {
        return activeGameId;
      },
      updateGame(entry: any) {
        return entry;
      }
    }
  });

  assert.throws(() => gameSessions.setActiveGame(""), /game id valido/);
  assert.throws(() => gameSessions.setActiveGame("missing-game"), /non trovata/);
  assert.throws(() => gameSessions.getGame(""), /game id valido/);
  assert.throws(() => gameSessions.openGame(""), /game id valido/);

  const fallback = await gameSessions.ensureActiveGame(() => {
    throw new Error("Existing games should be reused before creating a new one.");
  });
  assert.equal(fallback.game.id, "fallback-game");
  assert.equal(activeGameId, "fallback-game");

  activeGameId = "preferred-game";
  const preferred = await gameSessions.ensureActiveGame(() => {
    throw new Error("Preferred active game should be opened directly.");
  });
  assert.equal(preferred.game.id, "preferred-game");
});

register("game session store creates an initial game when no active game exists", async () => {
  const games: any[] = [];
  let activeGameId: string | null = null;
  let createInitialStateCalls = 0;

  const gameSessions = createGameSessionStore({
    datastore: {
      listGames() {
        return games;
      },
      createGame(entry: any) {
        games.push(entry);
        return entry;
      },
      setActiveGameId(gameId: string) {
        activeGameId = gameId;
      },
      findGameById(gameId: string) {
        return games.find((entry) => entry.id === gameId) || null;
      },
      getActiveGameId() {
        return activeGameId;
      },
      updateGame(entry: any) {
        return entry;
      }
    }
  });

  const created = await gameSessions.ensureActiveGame(() => {
    createInitialStateCalls += 1;
    return {
      phase: "lobby",
      players: [],
      territories: {},
      hands: {}
    };
  });

  assert.equal(createInitialStateCalls, 1);
  assert.equal(created.game.name, "Partita 1");
  assert.equal(created.state.phase, "lobby");
  assert.equal(activeGameId, created.game.id);
});

register("game session store validates save versions and exposes conflict snapshots", async () => {
  const games = [
    {
      id: "legacy-version",
      name: "Legacy Version Game",
      version: 0,
      creatorUserId: "u-1",
      state: { phase: "active", players: [{ id: "p-1", name: "commander" }] },
      createdAt: "2026-04-22T12:00:00.000Z",
      updatedAt: "2026-04-22T12:00:00.000Z"
    }
  ];

  const gameSessions = createGameSessionStore({
    datastore: {
      listGames() {
        return games;
      },
      createGame(entry: any) {
        games.push(entry);
        return entry;
      },
      setActiveGameId() {},
      findGameById(gameId: string) {
        return games.find((entry) => entry.id === gameId) || null;
      },
      getActiveGameId() {
        return null;
      },
      updateGame(entry: any) {
        const index = games.findIndex((candidate) => candidate.id === entry.id);
        if (index >= 0) {
          games[index] = entry;
        }
        return entry;
      }
    }
  });

  assert.throws(() => gameSessions.saveGame("", { phase: "active" }), /game id valido/);
  assert.throws(() => gameSessions.saveGame("legacy-version", null as any), /stato partita valido/);
  assert.throws(
    () => gameSessions.saveGame("legacy-version", { phase: "active" }, 0),
    /expectedVersion valida/
  );
  assert.throws(() => gameSessions.saveGame("missing-game", { phase: "active" }), /non trovata/);

  const saved = await gameSessions.saveGame(
    "legacy-version",
    { phase: "finished", players: [{ id: "p-1", name: "commander" }] },
    1
  );
  assert.equal(saved.version, 2);
  assert.equal(games[0].version, 2);
  assert.equal(games[0].state.phase, "finished");

  assert.throws(
    () => gameSessions.saveGame("legacy-version", { phase: "active" }, 1),
    (error: unknown) =>
      error instanceof Error &&
      (error as any).code === "VERSION_CONFLICT" &&
      (error as any).currentVersion === 2 &&
      (error as any).currentState.phase === "finished" &&
      (error as any).game.version === 2
  );
});

register("player profile store summarizes wins, losses, labels and active focus", async () => {
  const games = [
    {
      id: "completed-win",
      name: "Completed Win",
      updatedAt: "2026-04-22T08:00:00.000Z",
      state: {
        phase: "finished",
        winnerId: "p-1",
        currentTurnIndex: 0,
        players: [
          { id: "p-1", name: "commander", surrendered: false },
          { id: "p-2", name: "rival", surrendered: false }
        ],
        territories: {},
        hands: {}
      }
    },
    {
      id: "completed-loss",
      name: "Completed Loss",
      updatedAt: "2026-04-22T08:30:00.000Z",
      state: {
        phase: "finished",
        winnerId: "p-2",
        currentTurnIndex: 0,
        players: [
          { id: "p-1", name: "commander", surrendered: false },
          { id: "p-2", name: "rival", surrendered: false }
        ],
        territories: {},
        hands: {}
      }
    },
    {
      id: "lobby-game",
      name: "Lobby Game",
      updatedAt: "2026-04-22T09:00:00.000Z",
      state: {
        phase: "lobby",
        currentTurnIndex: 0,
        players: [{ id: "p-1", name: "commander", surrendered: false }],
        territories: {},
        hands: { "p-1": [] }
      }
    },
    {
      id: "active-turn",
      name: "Active Turn",
      updatedAt: "2026-04-22T10:00:00.000Z",
      state: {
        phase: "active",
        turnPhase: "reinforcement",
        currentTurnIndex: 0,
        players: [
          { id: "p-1", name: "commander", surrendered: false },
          { id: "p-2", name: "rival", surrendered: false }
        ],
        territories: {
          alaska: { ownerId: "p-1", armies: 3 },
          alberta: { ownerId: "p-2", armies: 2 }
        },
        hands: { "p-1": [{ id: "card-1" }, { id: "card-2" }] }
      }
    },
    {
      id: "active-eliminated",
      name: "Active Eliminated",
      updatedAt: "2026-04-22T11:00:00.000Z",
      state: {
        phase: "active",
        turnPhase: "fortify",
        currentTurnIndex: 1,
        players: [
          { id: "p-1", name: "commander", surrendered: true },
          { id: "p-2", name: "rival", surrendered: false }
        ],
        territories: {
          alberta: { ownerId: "p-2", armies: 4 }
        },
        hands: { "p-1": [] }
      }
    }
  ];

  const playerProfiles = createPlayerProfileStore({
    datastore: {
      listGames() {
        return games;
      }
    }
  });

  assert.throws(() => playerProfiles.getPlayerProfile("   "), /nome giocatore valido/);

  const profile = await playerProfiles.getPlayerProfile("commander");
  assert.equal(profile.gamesPlayed, 2);
  assert.equal(profile.wins, 1);
  assert.equal(profile.losses, 1);
  assert.equal(profile.winRate, 50);
  assert.equal(profile.gamesInProgress, 3);
  assert.equal(profile.hasHistory, true);
  assert.deepEqual(
    profile.participatingGames.map((entry: { id: string }) => entry.id),
    ["active-eliminated", "active-turn", "lobby-game"]
  );

  const eliminated = profile.participatingGames[0];
  assert.equal(eliminated.myLobby.statusLabel, "Eliminato");
  assert.equal(eliminated.myLobby.focusLabel, "In attesa");
  assert.equal(eliminated.myLobby.turnPhaseLabel, "Fortifica");
  assert.equal(eliminated.myLobby.territoryCount, 0);

  const activeTurn = profile.participatingGames[1];
  assert.equal(activeTurn.myLobby.statusLabel, "Operativo");
  assert.equal(activeTurn.myLobby.focusLabel, "Tocca a te");
  assert.equal(activeTurn.myLobby.turnPhaseLabel, "Rinforzi");
  assert.equal(activeTurn.myLobby.territoryCount, 1);
  assert.equal(activeTurn.myLobby.cardCount, 2);

  const lobby = profile.participatingGames[2];
  assert.equal(lobby.myLobby.statusLabel, "In attesa avvio");
  assert.equal(lobby.myLobby.focusLabel, "Lobby");
  assert.equal(lobby.myLobby.turnPhaseLabel, "Lobby");

  const emptyProfile = await playerProfiles.getPlayerProfile("observer");
  assert.equal(emptyProfile.gamesPlayed, 0);
  assert.equal(emptyProfile.wins, 0);
  assert.equal(emptyProfile.losses, 0);
  assert.equal(emptyProfile.winRate, null);
  assert.equal(emptyProfile.hasHistory, false);
  assert.deepEqual(emptyProfile.participatingGames, []);
});
