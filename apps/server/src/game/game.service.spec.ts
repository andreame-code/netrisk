import { GameService } from './game.service';
import { createInitialGameState } from '@netrisk/core';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('@netrisk/core', () => ({
  createInitialGameState: jest.fn(),
  joinGameRequestSchema: { parse: jest.fn() },
}));

describe('GameService', () => {
  const mockCreateInitialGameState =
    createInitialGameState as jest.MockedFunction<typeof createInitialGameState>;
  let prisma: { findLatestGame: jest.Mock };
  let service: GameService;

  beforeEach(() => {
    prisma = { findLatestGame: jest.fn() };
    service = new GameService(prisma as unknown as PrismaService);
    mockCreateInitialGameState.mockReset();
  });

  it('maps persisted game data into the lobby state shape', async () => {
    const createdAt = new Date('2024-03-25T10:15:00.000Z');
    const updatedAt = new Date('2024-03-25T10:20:00.000Z');
    prisma.findLatestGame.mockResolvedValue({
      id: 'game-123',
      code: 'ALFA',
      phase: 'lobby',
      rules: {
        minPlayers: 2,
        maxPlayers: 6,
        reinforcement: { minimum: 3, territoryDivisor: 3 },
        battle: { maxAttackerDice: 3, maxDefenderDice: 2 },
      },
      players: [
        {
          externalId: 'player-1',
          name: 'Alice',
          color: '#ff0000',
          role: 'attacker',
          status: 'online',
          territories: 5,
        },
        {
          externalId: 'player-2',
          name: 'Bob',
          color: '#0000ff',
          role: 'defender',
          status: 'disconnected',
          territories: 3,
        },
      ],
      createdAt,
      updatedAt,
    });

    await expect(service.getLobbyState()).resolves.toEqual({
      id: 'game-123',
      code: 'ALFA',
      phase: 'lobby',
      players: [
        {
          profile: {
            id: 'player-1',
            name: 'Alice',
            color: '#ff0000',
            role: 'attacker',
          },
          status: 'online',
          territories: 5,
        },
        {
          profile: {
            id: 'player-2',
            name: 'Bob',
            color: '#0000ff',
            role: 'defender',
          },
          status: 'disconnected',
          territories: 3,
        },
      ],
      rules: {
        minPlayers: 2,
        maxPlayers: 6,
        reinforcement: { minimum: 3, territoryDivisor: 3 },
        battle: { maxAttackerDice: 3, maxDefenderDice: 2 },
      },
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('falls back to a generated lobby state when retrieval fails', async () => {
    const fallbackState = {
      id: 'generated-id',
      code: 'LOBBY',
      phase: 'lobby',
      players: [],
      rules: {
        minPlayers: 2,
        maxPlayers: 6,
        reinforcement: { minimum: 3, territoryDivisor: 3 },
        battle: { maxAttackerDice: 3, maxDefenderDice: 2 },
      },
      createdAt: '2024-03-25T11:00:00.000Z',
      updatedAt: '2024-03-25T11:00:00.000Z',
    };

    prisma.findLatestGame.mockRejectedValue(new Error('database offline'));
    mockCreateInitialGameState.mockReturnValueOnce(fallbackState);

    await expect(service.getLobbyState()).resolves.toBe(fallbackState);
    expect(mockCreateInitialGameState).toHaveBeenCalledWith('LOBBY');
  });

  it('falls back to a generated lobby state when no persisted game exists', async () => {
    const fallbackState = {
      id: 'generated-id',
      code: 'LOBBY',
      phase: 'lobby',
      players: [],
      rules: {
        minPlayers: 2,
        maxPlayers: 6,
        reinforcement: { minimum: 3, territoryDivisor: 3 },
        battle: { maxAttackerDice: 3, maxDefenderDice: 2 },
      },
      createdAt: '2024-03-25T12:00:00.000Z',
      updatedAt: '2024-03-25T12:00:00.000Z',
    };

    prisma.findLatestGame.mockResolvedValue(null);
    mockCreateInitialGameState.mockReturnValueOnce(fallbackState);

    await expect(service.getLobbyState()).resolves.toBe(fallbackState);
    expect(mockCreateInitialGameState).toHaveBeenCalledWith('LOBBY');
  });
});
