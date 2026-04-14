import {
  getReinforcementRuleSet,
  STANDARD_REINFORCEMENT_RULE_SET_ID,
  type Continent,
  type GameState,
  type Player,
  type ReinforcementBonus
} from "../../shared/models.cjs";

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
  const controlledContinents = getControlledContinents(state, ownedTerritoryIds);
  const reinforcementRuleSet = getReinforcementRuleSet(state.reinforcementRuleSetId || STANDARD_REINFORCEMENT_RULE_SET_ID);
  const resolution = reinforcementRuleSet.resolve({
    territoryCount,
    controlledContinents
  });

  return {
    playerId,
    playerName: player.name,
    territoryCount,
    ownedTerritoryIds,
    baseReinforcements: resolution.baseReinforcements,
    minimumApplied: resolution.minimumApplied,
    continentBonuses: resolution.continentBonuses,
    continentBonusTotal: resolution.continentBonusTotal,
    totalReinforcements: resolution.totalReinforcements
  };
}
