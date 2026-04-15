import {
  getReinforcementRuleSet,
  STANDARD_REINFORCEMENT_RULE_SET_ID,
  type Continent,
  type GameState,
  type NetRiskGameplayEffects,
  type NetRiskReinforcementAdjustment,
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
  moduleAdjustments: NetRiskReinforcementAdjustment[];
  moduleBonusTotal: number;
  moduleMinimumTotal: number | null;
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

function resolveGameplayEffects(state: GameState): NetRiskGameplayEffects | null {
  const rawGameplayEffects = state?.gameConfig?.gameplayEffects;
  if (!rawGameplayEffects || typeof rawGameplayEffects !== "object" || Array.isArray(rawGameplayEffects)) {
    return null;
  }

  const reinforcementAdjustments = Array.isArray((rawGameplayEffects as { reinforcementAdjustments?: unknown }).reinforcementAdjustments)
    ? ((rawGameplayEffects as { reinforcementAdjustments?: Array<Record<string, unknown>> }).reinforcementAdjustments || [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.label === "string" && entry.label.trim())
        .map((entry) => ({
          id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : null,
          label: String(entry.label).trim(),
          flatBonus: Number.isInteger(entry.flatBonus) ? Number(entry.flatBonus) : null,
          minimumTotal: Number.isInteger(entry.minimumTotal) ? Number(entry.minimumTotal) : null
        }))
        .filter((entry) => (entry.flatBonus != null && entry.flatBonus >= 0) || (entry.minimumTotal != null && entry.minimumTotal > 0))
    : [];

  return {
    reinforcementAdjustments
  };
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
  const gameplayEffects = resolveGameplayEffects(state);
  const moduleAdjustments = Array.isArray(gameplayEffects?.reinforcementAdjustments)
    ? gameplayEffects.reinforcementAdjustments.map((entry) => ({ ...entry }))
    : [];
  const moduleBonusTotal = moduleAdjustments.reduce((total, entry) => total + (Number.isInteger(entry.flatBonus) ? Number(entry.flatBonus) : 0), 0);
  const moduleMinimumTotal = moduleAdjustments.reduce<number | null>((current, entry) => {
    if (!Number.isInteger(entry.minimumTotal) || Number(entry.minimumTotal) < 1) {
      return current;
    }

    return current == null ? Number(entry.minimumTotal) : Math.max(current, Number(entry.minimumTotal));
  }, null);
  const totalReinforcements = Math.max(
    resolution.totalReinforcements + moduleBonusTotal,
    moduleMinimumTotal == null ? 0 : moduleMinimumTotal
  );

  return {
    playerId,
    playerName: player.name,
    territoryCount,
    ownedTerritoryIds,
    baseReinforcements: resolution.baseReinforcements,
    minimumApplied: resolution.minimumApplied,
    continentBonuses: resolution.continentBonuses,
    continentBonusTotal: resolution.continentBonusTotal,
    moduleAdjustments,
    moduleBonusTotal,
    moduleMinimumTotal,
    totalReinforcements
  };
}
