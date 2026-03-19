const TurnPhase = Object.freeze({
  LOBBY: "lobby",
  REINFORCEMENT: "reinforcement",
  ATTACK: "attack",
  FORTIFY: "fortify",
  FINISHED: "finished"
});

function createPlayer(input = {}) {
  return {
    id: input.id || null,
    name: input.name || "",
    color: input.color || "#9aa6b2",
    connected: Boolean(input.connected),
    isAi: Boolean(input.isAi)
  };
}

function createTerritory(input = {}) {
  return {
    id: input.id || null,
    name: input.name || "",
    ownerId: input.ownerId || null,
    armies: input.armies || 0,
    continentId: input.continentId || null,
    neighbors: input.neighbors || []
  };
}

function createContinent(input = {}) {
  return {
    id: input.id || null,
    name: input.name || "",
    bonus: input.bonus || 0,
    territoryIds: input.territoryIds || []
  };
}

function createGameState(input = {}) {
  return {
    phase: input.phase || "lobby",
    turnPhase: input.turnPhase || TurnPhase.LOBBY,
    players: input.players || [],
    territories: input.territories || {},
    continents: input.continents || [],
    currentTurnIndex: input.currentTurnIndex || 0,
    reinforcementPool: input.reinforcementPool || 0,
    winnerId: input.winnerId || null,
    log: input.log || [],
    lastAction: input.lastAction || null,
    pendingConquest: input.pendingConquest || null,
    fortifyUsed: Boolean(input.fortifyUsed),
    cardRuleSetId: input.cardRuleSetId || "standard",
    deck: Array.isArray(input.deck) ? input.deck : [],
    hands: input.hands || {},
    tradeCount: Number.isInteger(input.tradeCount) ? input.tradeCount : 0,
    conqueredTerritoryThisTurn: Boolean(input.conqueredTerritoryThisTurn)
  };
}

module.exports = {
  TurnPhase,
  createContinent,
  createGameState,
  createPlayer,
  createTerritory
};

