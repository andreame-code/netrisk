import type { Continent, GameState, Player } from "../../shared/models.cjs";

export interface ReinforcementBonus {
  continentId: string | null;
  continentName: string;
  bonus: number;
  territoryIds: string[];
}

export interface ReinforcementCalculation {
  playerId: string;
  playerName: string;
  territoryCount: number;
  ownedTerritoryIds: string[];
  baseReinforcements: number;
  minimumApplied: boolean;
  continentBonuses: ReinforcementBonus[];
  continentBonusTotal: number;
  totalReinforcements: number;
}

function validateState(state: GameState): void {
  if (!state || typeof state !== "object") {
    throw new Error("Reinforcement calculation requires a valid game state.");
  }

  if (!Array.isArray(state.players) || state.players.length === 0) {
    throw new Error("Game state must contain at least one player.");
  }

  if (!state.territories || typeof state.territories !== "object") {
    throw new Error("Game state must contain territory ownership data.");
  }

  if (!Array.isArray(state.continents)) {
    throw new Error("Game state must define continents as an array.");
  }
}

function getPlayer(state: GameState, playerId: string): Player | null {
  return state.players.find((player) => player.id === playerId) || null;
}

function getOwnedTerritoryIds(state: GameState, playerId: string): string[] {
  return Object.keys(state.territories).filter((territoryId) => {
    const territoryState = state.territories[territoryId];
    return territoryState && territoryState.ownerId === playerId;
  });
}

function getControlledContinents(state: GameState, ownedTerritoryIds: string[]): Continent[] {
  const ownedSet = new Set(ownedTerritoryIds);

  return state.continents.filter((continent, index) => {
    if (!continent || !continent.id) {
      throw new Error(`Continent entry at index ${index} is invalid.`);
    }

    if (!Array.isArray(continent.territoryIds)) {
      throw new Error(`Continent "${continent.id}" must define territoryIds as an array.`);
    }

    return continent.territoryIds.length > 0 && continent.territoryIds.every((territoryId) => ownedSet.has(territoryId));
  });
}

export function calculateReinforcements(state: GameState, playerId: string): ReinforcementCalculation {
  validateState(state);

  if (!playerId) {
    throw new Error("Reinforcement calculation requires a player id.");
  }

  const player = getPlayer(state, playerId);
  if (!player) {
    throw new Error(`Unknown player "${playerId}" for reinforcement calculation.`);
  }

  const ownedTerritoryIds = getOwnedTerritoryIds(state, playerId);
  const territoryCount = ownedTerritoryIds.length;
  const rawBaseReinforcements = Math.floor(territoryCount / 3);
  const baseReinforcements = Math.max(3, rawBaseReinforcements);
  const minimumApplied = baseReinforcements !== rawBaseReinforcements;

  const controlledContinents = getControlledContinents(state, ownedTerritoryIds);
  const continentBonuses = controlledContinents.map((continent) => ({
    continentId: continent.id,
    continentName: continent.name,
    bonus: Number(continent.bonus) || 0,
    territoryIds: continent.territoryIds.slice()
  }));

  const continentBonusTotal = continentBonuses.reduce((total, entry) => total + entry.bonus, 0);

  return {
    playerId,
    playerName: player.name,
    territoryCount,
    ownedTerritoryIds,
    baseReinforcements,
    minimumApplied,
    continentBonuses,
    continentBonusTotal,
    totalReinforcements: baseReinforcements + continentBonusTotal
  };
}
