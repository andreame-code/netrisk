import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createInitialGameState,
  defaultGameRules,
  gameStateSchema,
  playerProfileSchema,
} from '@netrisk/core';

const ensureCrypto = (): Crypto => {
  if (!globalThis.crypto) {
    throw new Error('Global crypto API is not available for tests.');
  }
  return globalThis.crypto as Crypto;
};

describe('playerProfileSchema', () => {
  it('applies defaults for color and role when omitted', () => {
    const result = playerProfileSchema.parse({
      id: 'player-1',
      name: 'Alex',
    });

    expect(result.color).toBe('#3366ff');
    expect(result.role).toBe('attacker');
  });

  it('rejects invalid color inputs', () => {
    const result = playerProfileSchema.safeParse({
      id: 'player-1',
      name: 'Alex',
      color: 'blue',
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty identifiers', () => {
    const result = playerProfileSchema.safeParse({
      id: '',
      name: 'Alex',
    });

    expect(result.success).toBe(false);
  });
});

describe('gameStateSchema', () => {
  const baseTimestamps = {
    createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  };

  it('applies default game rules when omitted', () => {
    const result = gameStateSchema.parse({
      id: '00000000-0000-0000-0000-000000000000',
      code: 'ABCD',
      phase: 'lobby',
      players: [],
      ...baseTimestamps,
    });

    expect(result.rules).toEqual(defaultGameRules);
  });

  it('rejects invalid phase transitions', () => {
    const result = gameStateSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000000',
      code: 'ABCD',
      phase: 'invalid',
      players: [],
      ...baseTimestamps,
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid identifiers', () => {
    const result = gameStateSchema.safeParse({
      id: 'not-a-uuid',
      code: 'ABCD',
      phase: 'lobby',
      players: [],
      ...baseTimestamps,
    });

    expect(result.success).toBe(false);
  });
});

describe('createInitialGameState', () => {
  const mockedUuid = 'mocked-uuid';

  beforeEach(() => {
    vi.spyOn(ensureCrypto(), 'randomUUID').mockReturnValue(mockedUuid);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aligns timestamps with the provided creation date', () => {
    const createdAt = new Date('2024-02-20T10:20:30.000Z');
    const state = createInitialGameState('TEST', createdAt);

    expect(state.id).toBe(mockedUuid);
    expect(state.createdAt).toBe(createdAt.toISOString());
    expect(state.updatedAt).toBe(createdAt.toISOString());
  });

  it('creates an isolated copy of default rules', () => {
    const state = createInitialGameState('TEST');

    state.rules.minPlayers = 5;

    expect(state.rules).not.toBe(defaultGameRules);
    expect(defaultGameRules.minPlayers).toBe(2);
    expect(state.rules.minPlayers).toBe(5);
  });
});
