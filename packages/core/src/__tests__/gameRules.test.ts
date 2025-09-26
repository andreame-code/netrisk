import { describe, expect, it } from 'vitest';
import {
  calculateReinforcements,
  canStartGame,
  createInitialGameState,
  defaultGameRules,
} from '@netrisk/core';
import { joinGameRequestSchema } from '@netrisk/core';

describe('game rules', () => {
  it('calculates reinforcements with minimum threshold', () => {
    expect(calculateReinforcements(5)).toBe(defaultGameRules.reinforcement.minimum);
    expect(calculateReinforcements(12)).toBe(4);
  });

  it('validates player counts', () => {
    expect(canStartGame(2)).toBe(true);
    expect(canStartGame(1)).toBe(false);
    expect(canStartGame(7)).toBe(false);
  });

  it('creates initial game state with metadata', () => {
    const state = createInitialGameState('ABCD');
    expect(state.players).toHaveLength(0);
    expect(state.code).toBe('ABCD');
    expect(state.rules.maxPlayers).toBe(defaultGameRules.maxPlayers);
  });

  it('validates join game payloads with zod schema', () => {
    const result = joinGameRequestSchema.safeParse({
      gameCode: 'RISK12',
      player: {
        id: 'player-1',
        name: 'Alex',
        color: '#ff0000',
        role: 'attacker',
      },
    });

    expect(result.success).toBe(true);
  });
});
