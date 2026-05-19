const assert = require("node:assert/strict");
const {
  createInitialState,
  forceEndTurn,
  startGame
} = require("../../../backend/engine/game-engine.cjs");
const { enforceTurnTimeouts } = require("../../../backend/services/turn-timeout-enforcement.cjs");
const {
  isSessionTokenStorageKey,
  sessionTokenStorageKey
} = require("../../../backend/session-token.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type SaveVersion = number | null | undefined;

function createExpiredTimeoutState(options: { aiCurrentPlayer?: boolean } = {}) {
  const state = createInitialState();
  state.players = [
    {
      id: "p1",
      name: options.aiCurrentPlayer ? "CPU Alpha" : "Alice",
      color: "#111111",
      connected: true,
      isAi: options.aiCurrentPlayer || undefined
    },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  state.gameConfig = { mapId: "classic-mini", turnTimeoutHours: 24 };
  startGame(state, () => 0);
  state.turnStartedAt = new Date("2026-04-12T07:00:00.000Z").toISOString();
  return state;
}

register("session token storage keys hash empty and invalid inputs deterministically", () => {
  const emptyKey = sessionTokenStorageKey(undefined);
  const nullKey = sessionTokenStorageKey(null);
  const validKey = sessionTokenStorageKey("plain-session-token");

  assert.equal(emptyKey, nullKey);
  assert.equal(isSessionTokenStorageKey(emptyKey), true);
  assert.equal(isSessionTokenStorageKey(validKey), true);
  assert.equal(isSessionTokenStorageKey("plain-session-token"), false);
  assert.equal(isSessionTokenStorageKey(undefined), false);
});

register("turn timeout enforcement skips saves that hit version conflicts", async () => {
  const state = createExpiredTimeoutState();

  const result = await enforceTurnTimeouts({
    listGames: () => [{ id: "timeout-conflict", name: "Timeout Conflict", version: 3, state }],
    saveGame: () => {
      const error = new Error("stale timeout save");
      (error as Error & { code?: string }).code = "VERSION_CONFLICT";
      throw error;
    },
    forceEndTurn,
    now: new Date("2026-04-14T08:00:00.000Z")
  });

  assert.equal(result.scannedGames, 1);
  assert.equal(result.expiredGames, 1);
  assert.equal(result.forcedTurns, 0);
  assert.equal(result.skippedConflicts, 1);
});

register(
  "turn timeout enforcement persists AI recovery and reports the final version",
  async () => {
    const state = createExpiredTimeoutState({ aiCurrentPlayer: true });
    const savedVersions: SaveVersion[] = [];
    const afterSavePayloads: any[] = [];

    const result = await enforceTurnTimeouts({
      listGames: () => [{ id: "timeout-ai", name: "Timeout AI", version: 7, state }],
      saveGame: (
        _gameId: string,
        _state: Record<string, unknown>,
        expectedVersion?: SaveVersion
      ) => {
        savedVersions.push(expectedVersion);
        return { version: savedVersions.length === 1 ? 8 : 9 };
      },
      forceEndTurn,
      recoverAiTurnState: async (_state: Record<string, unknown>, context: any) => {
        assert.equal(context.now.toISOString(), "2026-04-14T08:00:00.000Z");
        assert.equal(context.forceEndTurn, forceEndTurn);
        return {
          eligible: true,
          attempted: true,
          advanced: false,
          forcedTurn: false,
          interceptedError: false,
          shouldPersist: true,
          reports: []
        };
      },
      afterSave: (payload: any) => {
        afterSavePayloads.push(payload);
      },
      now: new Date("2026-04-14T08:00:00.000Z")
    });

    assert.deepEqual(savedVersions, [7, 8]);
    assert.equal(afterSavePayloads.length, 1);
    assert.equal(afterSavePayloads[0].gameId, "timeout-ai");
    assert.equal(afterSavePayloads[0].gameName, "Timeout AI");
    assert.equal(afterSavePayloads[0].state, state);
    assert.equal(afterSavePayloads[0].version, 9);
    assert.equal(result.forcedTurns, 1);
    assert.equal(result.skippedConflicts, 0);
  }
);

register("turn timeout enforcement keeps null versions for legacy saves", async () => {
  const state = createExpiredTimeoutState();
  const expectedVersions: SaveVersion[] = [];
  const afterSavePayloads: any[] = [];

  const result = await enforceTurnTimeouts({
    listGames: () => [{ id: "timeout-legacy-version", name: "Timeout Legacy", state }],
    saveGame: (_gameId: string, _state: Record<string, unknown>, expectedVersion?: SaveVersion) => {
      expectedVersions.push(expectedVersion);
      return null;
    },
    forceEndTurn,
    afterSave: (payload: any) => {
      afterSavePayloads.push(payload);
    },
    now: new Date("2026-04-14T08:00:00.000Z")
  });

  assert.deepEqual(expectedVersions, [null]);
  assert.equal(afterSavePayloads.length, 1);
  assert.equal(afterSavePayloads[0].version, null);
  assert.equal(result.forcedTurns, 1);
});

register("turn timeout enforcement propagates unrecoverable save errors", async () => {
  const state = createExpiredTimeoutState();

  await assert.rejects(
    () =>
      enforceTurnTimeouts({
        listGames: () => [{ id: "timeout-save-error", name: "Timeout", version: 4, state }],
        saveGame: () => {
          throw new Error("datastore unavailable");
        },
        forceEndTurn,
        now: new Date("2026-04-14T08:00:00.000Z")
      }),
    /datastore unavailable/
  );
});

register("turn timeout enforcement propagates engine force failures", async () => {
  const state = createExpiredTimeoutState();

  await assert.rejects(
    () =>
      enforceTurnTimeouts({
        listGames: () => [{ id: "timeout-engine-failure", name: "Timeout", version: 1, state }],
        saveGame: () => {
          throw new Error("save should not be called");
        },
        forceEndTurn: () => ({ ok: false }),
        now: new Date("2026-04-14T08:00:00.000Z")
      }),
    /Impossibile forzare il turno della partita timeout-engine-failure/
  );
});
