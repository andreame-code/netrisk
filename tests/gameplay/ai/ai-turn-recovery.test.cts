const assert = require("node:assert/strict");
const {
  createInitialState,
  startGame
} = require("../../../backend/engine/game-engine.cjs");
const { recoverAiTurnState } = require("../../../backend/services/ai-turn-recovery.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function setupAiGame() {
  const state = createInitialState();
  state.players = [
    { id: "p1", name: "CPU Alpha", color: "#111111", connected: true, isAi: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  startGame(state, () => 0, new Date("2026-04-10T08:00:00.000Z"));
  return state;
}

register("recoverAiTurnState ignora turni non AI", async () => {
  const state = setupAiGame();
  state.players[0].isAi = false;

  const result = await recoverAiTurnState(state, {
    runAiTurnsIfNeeded: () => {
      throw new Error("runAiTurnsIfNeeded should not run for non-AI turns.");
    }
  });

  assert.equal(result.eligible, false);
  assert.equal(result.attempted, false);
  assert.equal(result.shouldPersist, false);
});

register("recoverAiTurnState lascia proseguire un turno AI sano senza forzature", async () => {
  const state = setupAiGame();

  const result = await recoverAiTurnState(state, {
    runAiTurnsIfNeeded: (targetState: typeof state) => {
      targetState.currentTurnIndex = 1;
      targetState.turnPhase = "reinforcement";
      targetState.reinforcementPool = 3;
      targetState.turnStartedAt = "2026-04-10T09:00:00.000Z";
      return [{ ok: true }];
    }
  });

  assert.equal(result.eligible, true);
  assert.equal(result.attempted, true);
  assert.equal(result.advanced, true);
  assert.equal(result.forcedTurn, false);
  assert.equal(result.shouldPersist, true);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
});

register("recoverAiTurnState forza la chiusura del turno se il resume AI fallisce", async () => {
  const state = setupAiGame();

  const result = await recoverAiTurnState(state, {
    runAiTurnsIfNeeded: () => {
      throw new Error("AI exploded");
    }
  });

  assert.equal(result.interceptedError, true);
  assert.equal(result.forcedTurn, true);
  assert.equal(result.shouldPersist, true);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.lastAction.summaryKey, "game.log.aiTurnRecovered");
});

register("recoverAiTurnState forza il turno se il resume non avanza la stessa AI", async () => {
  const state = setupAiGame();

  const result = await recoverAiTurnState(state, {
    runAiTurnsIfNeeded: () => []
  });

  assert.equal(result.interceptedError, false);
  assert.equal(result.forcedTurn, true);
  assert.equal(result.shouldPersist, true);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
});

register("recoverAiTurnState e idempotente dopo un recovery gia completato", async () => {
  const state = setupAiGame();

  const first = await recoverAiTurnState(state, {
    runAiTurnsIfNeeded: () => []
  });
  const second = await recoverAiTurnState(state, {
    runAiTurnsIfNeeded: () => []
  });

  assert.equal(first.forcedTurn, true);
  assert.equal(second.eligible, false);
  assert.equal(second.forcedTurn, false);
  assert.equal(second.shouldPersist, false);
});
