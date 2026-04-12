// @ts-nocheck
const { createContinent, createGameState, createPlayer, createTerritory, TurnPhase } = require("../../../shared/models.cjs");
const { buildMapGraph } = require("../../../shared/map-graph.cjs");

function makePlayer(id, name, overrides = {}) {
  return createPlayer({
    id,
    name,
    color: overrides.color || ("#" + String(id || "p1").padEnd(6, "0").slice(0, 6)),
    connected: overrides.connected !== false,
    ...overrides
  });
}

function makePlayers(names = ["Alice", "Bob"]) {
  return names.map((name, index) => makePlayer(`p${index + 1}`, name));
}

function makeTerritory(id, neighbors = [], overrides = {}) {
  return createTerritory({
    id,
    name: overrides.name || id.charAt(0).toUpperCase() + id.slice(1),
    neighbors,
    continentId: overrides.continentId || null,
    ownerId: overrides.ownerId || null,
    armies: overrides.armies == null ? 0 : overrides.armies,
    ...overrides
  });
}

function makeContinent(id, territoryIds, bonus = 0, overrides = {}) {
  return createContinent({
    id,
    name: overrides.name || id.charAt(0).toUpperCase() + id.slice(1),
    bonus,
    territoryIds,
    ...overrides
  });
}

function territoryStates(entries) {
  return entries.reduce((accumulator, entry) => {
    accumulator[entry.id] = {
      ownerId: entry.ownerId || null,
      armies: entry.armies == null ? 0 : entry.armies
    };
    return accumulator;
  }, {});
}

function makeState(options = {}) {
  const state = createGameState({
    phase: options.phase || "active",
    turnPhase: options.turnPhase || TurnPhase.REINFORCEMENT,
    players: options.players || makePlayers(),
    territories: options.territories || {},
    continents: options.continents || [],
    currentTurnIndex: options.currentTurnIndex || 0,
    reinforcementPool: options.reinforcementPool || 0,
    winnerId: options.winnerId || null,
    log: options.log || [],
    lastAction: options.lastAction || null,
    pendingConquest: options.pendingConquest || null,
    fortifyUsed: Boolean(options.fortifyUsed)
  });
  state.fortifyMoveUsed = Boolean(options.fortifyMoveUsed);
  return state;
}

function makeMapDefinition(territories, continents = []) {
  return {
    territories: territories.map((territory) => ({
      territory,
      position: { x: 0.5, y: 0.5 }
    })),
    continents
  };
}

function makeGraph(territories) {
  return buildMapGraph(territories);
}

module.exports = {
  TurnPhase,
  makeContinent,
  makeGraph,
  makeMapDefinition,
  makePlayer,
  makePlayers,
  makeState,
  makeTerritory,
  territoryStates
};
