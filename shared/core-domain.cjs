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
    isAi: Boolean(input.isAi),
    linkedUserId: input.linkedUserId || null,
    surrendered: Boolean(input.surrendered)
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
    mapId: input.mapId || "classic-mini",
    mapName: input.mapName || null,
    mapTerritories: Array.isArray(input.mapTerritories) ? input.mapTerritories : [],
    mapPositions: input.mapPositions || {},
    mapImageUrl: input.mapImageUrl || null,
    mapAspectRatio: input.mapAspectRatio || null,
    communityId: input.communityId || null,
    gameModeId: input.gameModeId || null,
    gameModeDefinition: input.gameModeDefinition || null,
    currentTurnIndex: input.currentTurnIndex || 0,
    reinforcementPool: input.reinforcementPool || 0,
    winnerId: input.winnerId || null,
    log: input.log || [],
    logEntries: Array.isArray(input.logEntries) ? input.logEntries : [],
    lastAction: input.lastAction || null,
    pendingConquest: input.pendingConquest || null,
    fortifyUsed: Boolean(input.fortifyUsed),
    cardRuleSetId: input.cardRuleSetId || "standard",
    deck: Array.isArray(input.deck) ? input.deck : [],
    discardPile: Array.isArray(input.discardPile) ? input.discardPile : [],
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
