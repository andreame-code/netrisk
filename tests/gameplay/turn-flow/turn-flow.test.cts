const assert = require("node:assert/strict");
const {
  TurnPhase,
  advanceTurn,
  applyReinforcement,
  createInitialState,
  endTurn,
  surrenderPlayer,
  startGame
} = require("../../../backend/engine/game-engine.cjs");
const { findSupportedMap } = require("../../../shared/maps/index.cjs");
const { createFixedRandom } = require("../helpers/random.cjs");

type TerritoryOwnerState = {
  ownerId: string | null;
  armies: number;
};

type PlayerRef = {
  id: string;
  surrendered?: boolean;
};

declare function register(name: string, fn: () => void | Promise<void>): void;

function setupLiveGame() {
  const state = createInitialState();
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  startGame(state, createFixedRandom(new Array(20).fill(0)));
  return state;
}

function createAttackPhaseState(overrides: {
  playerArmies?: number;
  enemyArmies?: number;
  attacksThisTurn?: number;
  gameplayEffects?: Record<string, unknown>;
} = {}) {
  const state = createInitialState();
  state.phase = "active";
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true, isAi: false, linkedUserId: null, surrendered: false },
    { id: "p2", name: "Bob", color: "#222222", connected: true, isAi: false, linkedUserId: null, surrendered: false }
  ];
  state.currentTurnIndex = 0;
  state.turnPhase = TurnPhase.ATTACK;
  state.reinforcementPool = 0;
  state.mapTerritories = [
    { id: "a", name: "Alpha", ownerId: null, armies: 0, continentId: null, neighbors: ["b"] },
    { id: "b", name: "Beta", ownerId: null, armies: 0, continentId: null, neighbors: ["a"] }
  ];
  state.territories = {
    a: { ownerId: "p1", armies: overrides.playerArmies ?? 4 },
    b: { ownerId: "p2", armies: overrides.enemyArmies ?? 2 }
  };
  state.attacksThisTurn = overrides.attacksThisTurn ?? 0;
  state.gameConfig = {
    ...(state.gameConfig || {}),
    gameplayEffects: overrides.gameplayEffects || null
  };
  return state;
}

register("applyReinforcement transitions from reinforcement to attack when pool reaches zero", () => {
  const state = setupLiveGame();
  const currentPlayer = state.players[state.currentTurnIndex];
  const ownedTerritoryId = Object.keys(state.territories).find((territoryId: string) => state.territories[territoryId].ownerId === currentPlayer.id);
  if (!ownedTerritoryId) {
    throw new Error("Expected at least one owned territory for the current player.");
  }

  while (state.reinforcementPool > 0) {
    const result = applyReinforcement(state, currentPlayer.id, ownedTerritoryId);
    assert.equal(result.ok, true);
  }

  assert.equal(state.turnPhase, TurnPhase.ATTACK);
  assert.equal(state.reinforcementPool, 0);
});

register("applyReinforcement supports batched placement in a single action", () => {
  const state = setupLiveGame();
  const currentPlayer = state.players[state.currentTurnIndex];
  const ownedTerritoryId = Object.keys(state.territories).find((territoryId: string) => state.territories[territoryId].ownerId === currentPlayer.id);
  if (!ownedTerritoryId) {
    throw new Error("Expected at least one owned territory for the current player.");
  }
  const startingArmies = state.territories[ownedTerritoryId].armies;
  const totalReinforcements = state.reinforcementPool;

  const result = applyReinforcement(state, currentPlayer.id, ownedTerritoryId, totalReinforcements);

  assert.equal(result.ok, true);
  assert.equal(state.territories[ownedTerritoryId].armies, startingArmies + totalReinforcements);
  assert.equal(state.reinforcementPool, 0);
  assert.equal(state.turnPhase, TurnPhase.ATTACK);
});

register("endTurn transitions from attack to fortify before advancing the turn", () => {
  const state = setupLiveGame();
  const currentPlayer = state.players[state.currentTurnIndex];
  const ownedTerritoryId = Object.keys(state.territories).find((territoryId: string) => state.territories[territoryId].ownerId === currentPlayer.id);
  if (!ownedTerritoryId) {
    throw new Error("Expected at least one owned territory for the current player.");
  }

  while (state.reinforcementPool > 0) {
    applyReinforcement(state, currentPlayer.id, ownedTerritoryId);
  }

  const result = endTurn(state, currentPlayer.id);
  assert.equal(result.ok, true);
  assert.equal(result.requiresFortifyDecision, true);
  assert.equal(state.turnPhase, TurnPhase.FORTIFY);
});

register("endTurn blocca l'uscita dalla fase attacco finche il minimo modulare non e soddisfatto", () => {
  const state = createAttackPhaseState({
    gameplayEffects: {
      minimumAttacksPerTurn: 1
    }
  });

  const result = endTurn(state, "p1");

  assert.equal(result.ok, false);
  assert.match(result.message, /almeno 1 attacchi/i);
  assert.equal(result.messageKey, "game.endTurn.minimumAttacksRequired");
  assert.deepEqual(result.messageParams, {
    minimumAttacksPerTurn: 1,
    attacksThisTurn: 0
  });
  assert.equal(state.turnPhase, TurnPhase.ATTACK);
});

register("endTurn consente la fortifica se il minimo attacchi non e soddisfatto ma non esistono attacchi legali", () => {
  const state = createAttackPhaseState({
    playerArmies: 1,
    gameplayEffects: {
      minimumAttacksPerTurn: 2
    }
  });

  const result = endTurn(state, "p1");

  assert.equal(result.ok, true);
  assert.equal(result.requiresFortifyDecision, true);
  assert.equal(state.turnPhase, TurnPhase.FORTIFY);
});

register("endTurn from fortify advances to the next active player reinforcement phase", () => {
  const state = setupLiveGame();
  const firstPlayer = state.players[state.currentTurnIndex];
  const ownedTerritoryId = Object.keys(state.territories).find((territoryId: string) => state.territories[territoryId].ownerId === firstPlayer.id);
  if (!ownedTerritoryId) {
    throw new Error("Expected at least one owned territory for the current player.");
  }

  while (state.reinforcementPool > 0) {
    applyReinforcement(state, firstPlayer.id, ownedTerritoryId);
  }

  endTurn(state, firstPlayer.id);
  const result = endTurn(state, firstPlayer.id);

  assert.equal(result.ok, true);
  assert.equal(state.currentTurnIndex, 1);
  assert.equal(state.turnPhase, TurnPhase.REINFORCEMENT);
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.reinforcementPool >= 3, true);
});

register("advanceTurn resetta il contatore attacchi del nuovo turno", () => {
  const state = setupLiveGame();
  const firstPlayer = state.players[state.currentTurnIndex];
  const ownedTerritoryId = Object.keys(state.territories).find((territoryId: string) => state.territories[territoryId].ownerId === firstPlayer.id);
  if (!ownedTerritoryId) {
    throw new Error("Expected at least one owned territory for the current player.");
  }

  while (state.reinforcementPool > 0) {
    applyReinforcement(state, firstPlayer.id, ownedTerritoryId);
  }

  state.attacksThisTurn = 2;
  endTurn(state, firstPlayer.id);
  endTurn(state, firstPlayer.id);

  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.attacksThisTurn, 0);
});

register("advanceTurn awards continent bonuses through the game engine reinforcement pool", () => {
  const state = createInitialState(findSupportedMap("world-classic"));
  state.phase = "active";
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  state.currentTurnIndex = 1;
  state.turnPhase = TurnPhase.FORTIFY;
  state.reinforcementPool = 0;

  Object.keys(state.territories).forEach((territoryId: string) => {
    state.territories[territoryId] = { ownerId: "p2", armies: 1 };
  });

  ["indonesia", "new_guinea", "western_australia", "eastern_australia"].forEach((territoryId) => {
    state.territories[territoryId] = { ownerId: "p1", armies: 1 };
  });

  advanceTurn(state);

  assert.equal(state.players[state.currentTurnIndex].id, "p1");
  assert.equal(state.turnPhase, TurnPhase.REINFORCEMENT);
  assert.equal(state.reinforcementPool, 5);
});

register("endTurn fails clearly when reinforcements are still available", () => {
  const state = setupLiveGame();
  const currentPlayer = state.players[state.currentTurnIndex];

  const result = endTurn(state, currentPlayer.id);
  assert.equal(result.ok, false);
  assert.match(result.message, /spendi prima tutti i rinforzi/i);
});

register("advanceTurn skips players with zero territories and can finish the game", () => {
  const state = setupLiveGame();
  state.currentTurnIndex = 0;
  Object.keys(state.territories).forEach((territoryId: string) => {
    state.territories[territoryId].ownerId = "p1";
  });
  state.turnPhase = TurnPhase.FORTIFY;
  state.reinforcementPool = 0;

  advanceTurn(state);

  assert.equal(state.winnerId, "p1");
  assert.equal(state.phase, "finished");
});

register("surrenderPlayer during the active turn hands off play to the next surviving player", () => {
  const state = setupLiveGame();
  state.players.push({ id: "p3", name: "Carol", color: "#333333", connected: true });
  const reassignedTerritoryId = Object.keys(state.territories).find((territoryId: string) => state.territories[territoryId].ownerId === "p2");
  if (!reassignedTerritoryId) {
    throw new Error("Expected at least one territory owned by p2.");
  }
  state.territories[reassignedTerritoryId].ownerId = "p3";
  state.territories[reassignedTerritoryId].armies = 1;
  const currentPlayer = state.players[state.currentTurnIndex];

  const result = surrenderPlayer(state, currentPlayer.id);

  const surrenderedTerritoryId = Object.keys(state.territories).find((territoryId: string) => state.territories[territoryId].ownerId === currentPlayer.id);
  if (!surrenderedTerritoryId) {
    throw new Error("Expected surrendered player to keep at least one owned territory.");
  }
  assert.equal(result.ok, true);
  assert.equal(state.phase, "active");
  assert.equal(state.players[state.currentTurnIndex].id, "p2");
  assert.equal(state.players.find((player: PlayerRef) => player.id === currentPlayer.id).surrendered, true);
  assert.equal(state.territories[surrenderedTerritoryId].ownerId, currentPlayer.id);
  assert.equal(state.turnPhase, TurnPhase.REINFORCEMENT);
  assert.equal(state.reinforcementPool >= 3, true);
});
