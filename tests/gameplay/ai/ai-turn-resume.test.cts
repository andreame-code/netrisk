const assert = require("node:assert/strict");
const { runAiTurnsIfNeeded } = require("../../../backend/engine/ai-turn-resume.cjs");
const {
  TurnPhase,
  makePlayers,
  makeState,
  makeTerritory,
  territoryStates
} = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function withPatchedAdvanceTurn<T>(
  advanceTurn: (state: unknown) => void,
  run: (patchedRunAiTurnsIfNeeded: typeof runAiTurnsIfNeeded) => T
): T {
  const gameEnginePath = require.resolve("../../../backend/engine/game-engine.cjs");
  const aiTurnResumePath = require.resolve("../../../backend/engine/ai-turn-resume.cjs");
  const gameEngine = require(gameEnginePath);
  const originalAdvanceTurn = gameEngine.advanceTurn;
  const originalAiTurnResumeModule = require.cache[aiTurnResumePath];

  gameEngine.advanceTurn = advanceTurn;
  delete require.cache[aiTurnResumePath];

  try {
    const patchedRunAiTurnsIfNeeded = require(aiTurnResumePath).runAiTurnsIfNeeded;
    return run(patchedRunAiTurnsIfNeeded);
  } finally {
    gameEngine.advanceTurn = originalAdvanceTurn;
    delete require.cache[aiTurnResumePath];
    if (originalAiTurnResumeModule) {
      require.cache[aiTurnResumePath] = originalAiTurnResumeModule;
    }
  }
}

function createResumeState(options: {
  players?: ReturnType<typeof makePlayers>;
  phase?: string;
  winnerId?: string | null;
  currentTurnIndex?: number;
  territories?: ReturnType<typeof territoryStates>;
}) {
  const state = makeState({
    players: options.players || [
      { ...makePlayers(["CPU Alpha", "Bob"])[0], isAi: true },
      makePlayers(["CPU Alpha", "Bob"])[1]
    ],
    phase: options.phase || "active",
    winnerId: options.winnerId || null,
    currentTurnIndex: options.currentTurnIndex || 0,
    turnPhase: TurnPhase.REINFORCEMENT,
    territories:
      options.territories ||
      territoryStates([
        { id: "a", ownerId: "p1", armies: 3 },
        { id: "b", ownerId: "p2", armies: 2 }
      ])
  });

  (state as typeof state & { mapTerritories: ReturnType<typeof makeTerritory>[] }).mapTerritories =
    [makeTerritory("a", ["b"]), makeTerritory("b", ["a"])] ;
  return state;
}

register("runAiTurnsIfNeeded does not invoke the runner outside active AI turns", () => {
  const humanTurnState = createResumeState({
    players: makePlayers(["Alice", "Bob"]),
    currentTurnIndex: 0
  });
  const lobbyState = createResumeState({ phase: "lobby" });
  const finishedState = createResumeState({ winnerId: "p1" });
  let runnerCalls = 0;
  const runAiTurn = () => {
    runnerCalls += 1;
    return { ok: true };
  };

  assert.deepEqual(runAiTurnsIfNeeded(humanTurnState, { runAiTurn }), []);
  assert.deepEqual(runAiTurnsIfNeeded(lobbyState, { runAiTurn }), []);
  assert.deepEqual(runAiTurnsIfNeeded(finishedState, { runAiTurn }), []);
  assert.equal(runnerCalls, 0);
});

register("runAiTurnsIfNeeded skips surrendered stale AI turns before running AI logic", () => {
  const players = makePlayers(["CPU Alpha", "Bob", "Carla"]);
  players[0].isAi = true;
  players[0].surrendered = true;
  const state = createResumeState({
    players,
    territories: territoryStates([
      { id: "a", ownerId: "p2", armies: 3 },
      { id: "b", ownerId: "p3", armies: 2 }
    ])
  });

  const reports = runAiTurnsIfNeeded(state, {
    runAiTurn: () => {
      throw new Error("runAiTurn should not run for a surrendered AI player.");
    }
  });

  assert.deepEqual(reports, []);
  assert.equal(state.currentTurnIndex, 1);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
});

register("runAiTurnsIfNeeded throws when a stale AI turn cannot advance", () => {
  const players = makePlayers(["CPU Alpha"]);
  players[0].isAi = true;
  players[0].surrendered = true;
  const state = createResumeState({
    players,
    territories: territoryStates([{ id: "a", ownerId: "p1", armies: 3 }])
  });

  withPatchedAdvanceTurn(
    () => {},
    (patchedRunAiTurnsIfNeeded) => {
      assert.throws(
        () => patchedRunAiTurnsIfNeeded(state),
        (error: Error & { messageKey?: string | null }) => {
          assert.equal(error.messageKey, "server.aiTurn.failed");
          assert.match(error.message, /turno corrente non puo avanzare/i);
          return true;
        }
      );
    }
  );
  assert.equal(state.currentTurnIndex, 0);
});

register("runAiTurnsIfNeeded preserves AI failure localization details", () => {
  const state = createResumeState({});

  assert.throws(
    () =>
      runAiTurnsIfNeeded(state, {
        runAiTurn: () => ({
          ok: false,
          error: "AI policy rejected the turn.",
          errorKey: "server.aiTurn.policyRejected",
          errorParams: { policyId: "strict-ai" }
        })
      }),
    (error: Error & { messageKey?: string | null; messageParams?: Record<string, unknown> }) => {
      assert.equal(error.message, "AI policy rejected the turn.");
      assert.equal(error.messageKey, "server.aiTurn.policyRejected");
      assert.deepEqual(error.messageParams, { policyId: "strict-ai" });
      return true;
    }
  );
});

register("runAiTurnsIfNeeded returns reports from each resumed AI turn", () => {
  const players = makePlayers(["CPU Alpha", "CPU Beta", "Alice"]);
  players[0].isAi = true;
  players[1].isAi = true;
  const state = createResumeState({
    players,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 3 },
      { id: "b", ownerId: "p2", armies: 3 }
    ])
  });
  const random = () => 0.5;
  const seenRandomValues: number[] = [];

  const reports = runAiTurnsIfNeeded(state, {
    random,
    runAiTurn: (targetState: typeof state, options?: { random?: () => number }) => {
      seenRandomValues.push(options?.random?.() ?? -1);
      const playerId = targetState.players[targetState.currentTurnIndex].id;
      targetState.currentTurnIndex += 1;
      return { ok: true, playerId };
    }
  });

  assert.deepEqual(reports, [
    { ok: true, playerId: "p1" },
    { ok: true, playerId: "p2" }
  ]);
  assert.deepEqual(seenRandomValues, [0.5, 0.5]);
  assert.equal(state.currentTurnIndex, 2);
});
