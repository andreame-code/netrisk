import { describe, expect, it } from 'vitest';
import {
  calculateReinforcements,
  canStartGame,
  createInitialGameState,
  defaultGameRules,
} from '@netrisk/core';
import { joinGameRequestSchema } from '@netrisk/core';

describe('calculateReinforcements', () => {
  it('returns at least the minimum reinforcement when territories are limited', () => {
    expect(calculateReinforcements(5)).toBe(defaultGameRules.reinforcement.minimum);
  });

  it('rounds down based on the territory divisor', () => {
    expect(calculateReinforcements(12)).toBe(4);
  });

  it('respects custom reinforcement rules', () => {
    const customRules = {
      ...defaultGameRules,
      reinforcement: {
        minimum: 5,
        territoryDivisor: 2,
      },
    } as const;

    expect(calculateReinforcements(1, customRules)).toBe(5);
    expect(calculateReinforcements(9, customRules)).toBe(5);
    expect(calculateReinforcements(10, customRules)).toBe(5);
    expect(calculateReinforcements(11, customRules)).toBe(5);
    expect(calculateReinforcements(12, customRules)).toBe(6);
  });
});

describe('canStartGame', () => {
  it('validates player counts against default rules', () => {
    expect(canStartGame(defaultGameRules.minPlayers)).toBe(true);
    expect(canStartGame(defaultGameRules.minPlayers - 1)).toBe(false);
    expect(canStartGame(defaultGameRules.maxPlayers + 1)).toBe(false);
  });

  it('allows custom rule ranges', () => {
    const relaxedRules = {
      ...defaultGameRules,
      minPlayers: 3,
      maxPlayers: 8,
    } as const;

    expect(canStartGame(3, relaxedRules)).toBe(true);
    expect(canStartGame(2, relaxedRules)).toBe(false);
    expect(canStartGame(9, relaxedRules)).toBe(false);
  });
});

describe('createInitialGameState', () => {
  it('creates initial game state with default metadata', () => {
    const state = createInitialGameState('ABCD');

    expect(state.id).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
    expect(state.players).toHaveLength(0);
    expect(state.code).toBe('ABCD');
    expect(state.phase).toBe('lobby');
    expect(state.rules).toEqual(defaultGameRules);
    expect(new Date(state.createdAt).toString()).not.toBe('Invalid Date');
    expect(state.createdAt).toBe(state.updatedAt);
  });

  it('uses provided creation date for timestamps', () => {
    const createdAt = new Date('2024-02-03T10:20:30.000Z');
    const state = createInitialGameState('WXYZ', createdAt);

    expect(state.createdAt).toBe(createdAt.toISOString());
    expect(state.updatedAt).toBe(createdAt.toISOString());
  });
});

describe('joinGameRequestSchema', () => {
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

  it('rejects invalid payloads', () => {
    const result = joinGameRequestSchema.safeParse({
      gameCode: 'abc',
      player: {
        id: '',
        name: '',
        color: 'red',
        role: 'spy',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
