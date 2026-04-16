const assert = require("node:assert/strict");
const {
  createInitialState,
  forceEndTurn,
  startGame
} = require("../../../backend/engine/game-engine.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function setupTimedGame() {
  const state = createInitialState();
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  state.gameConfig = { mapId: "classic-mini", turnTimeoutHours: 24 };
  startGame(state, () => 0, new Date("2026-04-10T08:00:00.000Z"));
  return state;
}

register("forceEndTurn da reinforcement passa il controllo al giocatore successivo", () => {
  const state = setupTimedGame();
  const currentPlayer = state.players[state.currentTurnIndex];

  const result = forceEndTurn(state, currentPlayer.id, {
    reason: "timeout",
    turnTimeoutHours: 24,
    now: new Date("2026-04-11T08:00:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.equal(state.currentTurnIndex, 1);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.turnPhase, "reinforcement");
  assert.equal(state.reinforcementPool >= 3, true);
  assert.equal(state.lastAction.summaryKey, "game.log.turnTimedOut");
  assert.equal(state.turnStartedAt, "2026-04-11T08:00:00.000Z");
});

register(
  "forceEndTurn risolve la conquista pendente con il minimo prima di passare il turno",
  () => {
    const state = setupTimedGame();
    const currentPlayer = state.players[state.currentTurnIndex];
    const ownedOrigin = Object.keys(state.territories).find(
      (territoryId: string) => state.territories[territoryId].ownerId === currentPlayer.id
    );
    const enemyTerritory = Object.keys(state.territories).find(
      (territoryId: string) => state.territories[territoryId].ownerId !== currentPlayer.id
    );

    if (!ownedOrigin || !enemyTerritory) {
      throw new Error("Expected a valid origin and enemy territory.");
    }

    state.reinforcementPool = 0;
    state.turnPhase = "attack";
    state.territories[ownedOrigin].armies = 5;
    state.territories[enemyTerritory].ownerId = currentPlayer.id;
    state.territories[enemyTerritory].armies = 0;
    state.pendingConquest = {
      fromId: ownedOrigin,
      toId: enemyTerritory,
      minArmies: 2,
      maxArmies: 4
    };
    state.conqueredTerritoryThisTurn = true;

    const result = forceEndTurn(state, currentPlayer.id, {
      reason: "timeout",
      turnTimeoutHours: 24,
      now: new Date("2026-04-11T08:00:00.000Z")
    });

    assert.equal(result.ok, true);
    assert.equal(state.pendingConquest, null);
    assert.equal(state.territories[enemyTerritory].ownerId, currentPlayer.id);
    assert.equal(state.territories[enemyTerritory].armies, 2);
    assert.equal(state.players[state.currentTurnIndex].id, "p2");
  }
);

register("forceEndTurn usa un audit trail dedicato per il recovery AI", () => {
  const state = setupTimedGame();
  state.players[0].isAi = true;
  const currentPlayer = state.players[state.currentTurnIndex];

  const result = forceEndTurn(state, currentPlayer.id, {
    reason: "aiRecovery",
    now: new Date("2026-04-11T08:00:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.lastAction.summaryKey, "game.log.aiTurnRecovered");
});
