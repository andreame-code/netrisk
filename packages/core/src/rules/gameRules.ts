export interface ReinforcementRule {
  minimum: number;
  territoryDivisor: number;
}

export interface BattleRule {
  maxAttackerDice: number;
  maxDefenderDice: number;
}

export interface GameRules {
  minPlayers: number;
  maxPlayers: number;
  reinforcement: ReinforcementRule;
  battle: BattleRule;
}

export const defaultGameRules: GameRules = {
  minPlayers: 2,
  maxPlayers: 6,
  reinforcement: {
    minimum: 3,
    territoryDivisor: 3,
  },
  battle: {
    maxAttackerDice: 3,
    maxDefenderDice: 2,
  },
};

export function canStartGame(playerCount: number, rules: GameRules = defaultGameRules): boolean {
  return playerCount >= rules.minPlayers && playerCount <= rules.maxPlayers;
}

export function calculateReinforcements(
  territoryCount: number,
  rules: GameRules = defaultGameRules,
): number {
  const reinforcements = Math.floor(territoryCount / rules.reinforcement.territoryDivisor);
  return Math.max(rules.reinforcement.minimum, reinforcements);
}
