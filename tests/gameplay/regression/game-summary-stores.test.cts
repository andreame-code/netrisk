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

    assert.ok(resolvedMapGame);
    assert.ok(storedNameGame);
    assert.equal(resolvedMapGame.mapName, "Runtime Outpost");
    assert.equal(storedNameGame.mapName, "Archived World");
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

    assert.ok(resolvedMapGame);
    assert.ok(storedNameGame);
    assert.equal(resolvedMapGame.mapName, "Runtime Outpost");
    assert.equal(storedNameGame.mapName, "Archived World");
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
