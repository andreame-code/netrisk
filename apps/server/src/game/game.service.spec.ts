import { GameService } from './game.service';
import { createInitialGameState, joinGameRequestSchema } from '@netrisk/core';
import type { GameState, JoinGameRequest } from '@netrisk/core';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('@netrisk/core', () => ({
  createInitialGameState: jest.fn(),
  joinGameRequestSchema: { parse: jest.fn() },
}));

describe('GameService', () => {
  const mockCreateInitialGameState =
    createInitialGameState as jest.MockedFunction<typeof createInitialGameState>;
  const mockJoinGameRequestSchemaParse =
    joinGameRequestSchema.parse as jest.MockedFunction<
      typeof joinGameRequestSchema.parse
    >;
  let prisma: { findLatestGame: jest.Mock; upsertPlayer: jest.Mock };
  let service: GameService;

  beforeEach(() => {
    prisma = { findLatestGame: jest.fn(), upsertPlayer: jest.fn() };
    prisma.upsertPlayer.mockResolvedValue(undefined);
    service = new GameService(prisma as unknown as PrismaService);
    mockCreateInitialGameState.mockReset();
    mockJoinGameRequestSchemaParse.mockReset();
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

  describe('recordJoin', () => {
    const createSeedLobbyState = (): GameState => ({
      id: 'game-seed',
      code: 'SEED',
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
          territories: 4,
        },
        {
          profile: {
            id: 'player-2',
            name: 'Bob',
            color: '#0000ff',
            role: 'defender',
          },
          status: 'disconnected',
          territories: 2,
        },
        {
          profile: {
            id: 'player-3',
            name: 'Charlie',
            color: '#00ffcc',
            role: 'observer',
          },
          status: 'online',
          territories: 1,
        },
      ],
      rules: {
        minPlayers: 2,
        maxPlayers: 6,
        reinforcement: { minimum: 3, territoryDivisor: 3 },
        battle: { maxAttackerDice: 3, maxDefenderDice: 2 },
      },
      createdAt: '2024-04-01T09:00:00.000Z',
      updatedAt: '2024-04-01T09:30:00.000Z',
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('replaces the existing player with the parsed payload and updates metadata', async () => {
      const now = new Date('2024-04-02T10:15:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      const request: JoinGameRequest = {
        gameCode: 'BRAVO',
        player: {
          id: 'player-2',
          name: 'Bob',
          color: '#0000ff',
          role: 'defender',
        },
      };
      const parsedPayload: JoinGameRequest = {
        gameCode: 'BRAVO',
        player: {
          id: 'player-2',
          name: 'Robert',
          color: '#00ff00',
          role: 'defender',
        },
      };

      const seedState = createSeedLobbyState();
      const getLobbyStateSpy = jest
        .spyOn(service, 'getLobbyState')
        .mockResolvedValue(seedState);
      mockJoinGameRequestSchemaParse.mockReturnValue(parsedPayload);

      const result = await service.recordJoin(request);

      expect(mockJoinGameRequestSchemaParse).toHaveBeenCalledWith(request);
      expect(prisma.upsertPlayer).toHaveBeenCalledTimes(1);
      const [payloadArg, rulesArg, timestampArg] = prisma.upsertPlayer.mock
        .calls[0];
      expect(payloadArg).toBe(parsedPayload);
      expect(rulesArg).toBe(seedState.rules);
      expect(timestampArg).toEqual(now);

      expect(result).toEqual({
        ...seedState,
        code: 'BRAVO',
        players: [
          seedState.players[0],
          seedState.players[2],
          {
            profile: parsedPayload.player,
            status: 'online',
            territories: 0,
          },
        ],
        updatedAt: now.toISOString(),
      });
      expect(seedState.players).toHaveLength(3);

      getLobbyStateSpy.mockRestore();
    });

    it('still resolves with the updated state when persistence fails', async () => {
      const now = new Date('2024-04-02T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      const request: JoinGameRequest = {
        gameCode: 'CHARLIE',
        player: {
          id: 'player-2',
          name: 'Bob',
          color: '#0000ff',
          role: 'defender',
        },
      };
      const parsedPayload: JoinGameRequest = {
        gameCode: 'CHARLIE',
        player: {
          id: 'player-2',
          name: 'Bobby',
          color: '#ff8800',
          role: 'defender',
        },
      };

      const seedState = createSeedLobbyState();
      const getLobbyStateSpy = jest
        .spyOn(service, 'getLobbyState')
        .mockResolvedValue(seedState);
      mockJoinGameRequestSchemaParse.mockReturnValue(parsedPayload);
      prisma.upsertPlayer.mockRejectedValueOnce(new Error('persist failed'));

      await expect(service.recordJoin(request)).resolves.toEqual({
        ...seedState,
        code: 'CHARLIE',
        players: [
          seedState.players[0],
          seedState.players[2],
          {
            profile: parsedPayload.player,
            status: 'online',
            territories: 0,
          },
        ],
        updatedAt: now.toISOString(),
      });
      expect(prisma.upsertPlayer).toHaveBeenCalledTimes(1);
      expect(prisma.upsertPlayer.mock.calls[0][0]).toBe(parsedPayload);
      expect(prisma.upsertPlayer.mock.calls[0][1]).toBe(seedState.rules);
      expect(seedState.players.map((player) => player.profile.id)).toEqual([
        'player-1',
        'player-2',
        'player-3',
      ]);

      getLobbyStateSpy.mockRestore();
    });

    it('throws the validation error when the payload is invalid', async () => {
      const invalidRequest = {
        gameCode: 'bad',
        player: {
          id: '',
          name: '',
          color: 'red',
          role: 'attacker',
        },
      } as unknown as JoinGameRequest;
      const validationError = new Error('Invalid join request');
      mockJoinGameRequestSchemaParse.mockImplementation(() => {
        throw validationError;
      });

      const getLobbyStateSpy = jest.spyOn(service, 'getLobbyState');

      await expect(service.recordJoin(invalidRequest)).rejects.toBe(
        validationError,
      );
      expect(getLobbyStateSpy).not.toHaveBeenCalled();
      expect(prisma.upsertPlayer).not.toHaveBeenCalled();

      getLobbyStateSpy.mockRestore();
    });
  });
});
