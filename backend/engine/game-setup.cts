import {
  TurnPhase,
  createGameState,
  type Continent,
  type GameState,
  type Player,
  type Territory
} from "../../shared/models.cjs";

interface MapDefinitionEntry {
  territory: Territory;
}

interface LoadedMapDefinition {
  territories: MapDefinitionEntry[];
  continents?: Continent[];
}

function normalizePlayers(players: Player[]): Player[] {
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error("Game initialization requires at least one player.");
  }

  const playerIds = new Set<string>();

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

function normalizeMapEntries(mapDefinition: LoadedMapDefinition): Territory[] {
  if (
    !mapDefinition ||
    !Array.isArray(mapDefinition.territories) ||
    mapDefinition.territories.length === 0
  ) {
    throw new Error("Game initialization requires a loaded map with at least one territory.");
  }

  const territoryIds = new Set<string>();

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

export function createInitialGameState(
  mapDefinition: LoadedMapDefinition,
  players: Player[]
): GameState & { turnNumber: number } {
  const normalizedPlayers = normalizePlayers(players);
  const territories = normalizeMapEntries(mapDefinition);

  const territoryState = territories.reduce<
    Record<string, { ownerId: string | null; armies: number }>
  >((accumulator, territory, index) => {
    if (!territory.id) {
      throw new Error(`Map territory entry at index ${index} is missing an id.`);
    }

    const owner = normalizedPlayers[index % normalizedPlayers.length] as Player;
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
  }) as GameState & { turnNumber: number };

  state.turnNumber = 1;
  return state;
}
