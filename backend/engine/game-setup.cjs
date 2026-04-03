const { TurnPhase, createGameState } = require("../../shared/models.cjs");

function normalizePlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error("Game initialization requires at least one player.");
  }

  const playerIds = new Set();

  players.forEach((player, index) => {
    if (!player || !player.id) {
      throw new Error(`Player at index ${index} is missing an id.`);
    }

    if (!player.name || !String(player.name).trim()) {
      throw new Error(`Player "${player.id}" is missing a name.`);
    }

    if (playerIds.has(player.id)) {
      throw new Error(`Duplicate player id "${player.id}" in game initialization.`);
    }

    playerIds.add(player.id);
  });

  return players;
}

function normalizeMapEntries(mapDefinition) {
  if (!mapDefinition || !Array.isArray(mapDefinition.territories) || mapDefinition.territories.length === 0) {
    throw new Error("Game initialization requires a loaded map with at least one territory.");
  }

  const territoryIds = new Set();

  return mapDefinition.territories.map((entry, index) => {
    if (!entry || !entry.territory) {
      throw new Error(`Map territory entry at index ${index} is invalid.`);
    }

    const territory = entry.territory;
    if (!territory.id) {
      throw new Error(`Map territory entry at index ${index} is missing an id.`);
    }

    if (territoryIds.has(territory.id)) {
      throw new Error(`Duplicate territory id "${territory.id}" in loaded map.`);
    }

    territoryIds.add(territory.id);
    return territory;
  });
}

function createInitialGameState(mapDefinition, players) {
  const normalizedPlayers = normalizePlayers(players);
  const territories = normalizeMapEntries(mapDefinition);

  const territoryState = territories.reduce((accumulator, territory, index) => {
    const owner = normalizedPlayers[index % normalizedPlayers.length];
    accumulator[territory.id] = {
      ownerId: owner.id,
      armies: 1
    };
    return accumulator;
  }, {});

  const state = createGameState({
    phase: "active",
    turnPhase: TurnPhase.REINFORCEMENT,
    players: normalizedPlayers,
    territories: territoryState,
    continents: Array.isArray(mapDefinition.continents) ? mapDefinition.continents : [],
    currentTurnIndex: 0,
    reinforcementPool: 0,
    winnerId: null,
    log: ["Game initialized. Turn 1 begins."],
    lastAction: null
  });

  state.turnNumber = 1;
  return state;
}

module.exports = {
  createInitialGameState
};
