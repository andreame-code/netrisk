jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

import { PrismaClient as PrismaClientMock } from '@prisma/client';

import { PrismaService, prismaServiceTestUtils } from './prisma.service';

type MockPrismaClient = ReturnType<typeof createMockPrismaClient>;

const createMockPrismaClient = () => ({
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  game: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
});

const prismaClientConstructor = PrismaClientMock as jest.Mock;
const prismaModuleMock = {
  PrismaClient: prismaClientConstructor,
} as unknown as typeof import('@prisma/client');

let lastCreatedClient: MockPrismaClient | null = null;
let shouldThrowOnInstantiation = false;

const configurePrismaClientMock = () => {
  prismaClientConstructor.mockImplementation(() => {
    if (shouldThrowOnInstantiation) {
      throw new Error('initialization failure');
    }

    const client = createMockPrismaClient();
    lastCreatedClient = client;
    return client;
  });
};

beforeEach(() => {
  lastCreatedClient = null;
  shouldThrowOnInstantiation = false;
  prismaClientConstructor.mockReset();
  configurePrismaClientMock();
  prismaServiceTestUtils.setPrismaLoader(() =>
    Promise.resolve(prismaModuleMock),
  );
});

afterEach(() => {
  prismaServiceTestUtils.resetPrismaLoader();
});

describe('PrismaService', () => {
  describe('onModuleInit', () => {
    it('instantiates PrismaClient, connects, and stores the client', async () => {
      const service = new PrismaService();

      await service.onModuleInit();

      expect(PrismaClientMock).toHaveBeenCalledWith({ log: ['warn', 'error'] });
      expect(lastCreatedClient?.$connect).toHaveBeenCalledTimes(1);
      expect((service as { client: MockPrismaClient | null }).client).toBe(
        lastCreatedClient,
      );
    });

    it('resets the client when PrismaClient throws during initialization', async () => {
      shouldThrowOnInstantiation = true;
      configurePrismaClientMock();
      const service = new PrismaService();

      await service.onModuleInit();

      expect(
        (service as { client: MockPrismaClient | null }).client,
      ).toBeNull();
    });
  });

  describe('onModuleDestroy', () => {
    it('does nothing when no client is set', async () => {
      const service = new PrismaService();

      (service as { client: MockPrismaClient | null }).client = null;

      await service.onModuleDestroy();

      expect(
        (service as { client: MockPrismaClient | null }).client,
      ).toBeNull();
    });

    it('disconnects the client when present', async () => {
      const service = new PrismaService();
      const client = createMockPrismaClient();
      (service as { client: MockPrismaClient | null }).client = client;

      await service.onModuleDestroy();

      expect(client.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('findLatestGame', () => {
    it('returns null when no client is available', async () => {
      const service = new PrismaService();

      const result = await service.findLatestGame();

      expect(result).toBeNull();
    });

    it('delegates to prisma.game.findFirst when the client is set', async () => {
      const service = new PrismaService();
      const client = createMockPrismaClient();
      const expectedGame = { id: 'game-1' } as unknown;
      client.game.findFirst.mockResolvedValue(expectedGame);
      (service as { client: MockPrismaClient | null }).client = client;

      const result = await service.findLatestGame();

      expect(client.game.findFirst).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
        include: { players: true },
      });
      expect(result).toBe(expectedGame);
    });
  });

  describe('upsertPlayer', () => {
    const payload = {
      gameCode: 'ABCD',
      player: {
        id: 'player-1',
        name: 'Alice',
        color: 'blue',
        role: 'attacker',
      },
    } as const;

    it('returns immediately when no client is configured', async () => {
      const service = new PrismaService();

      await expect(
        service.upsertPlayer(payload, { maxPlayers: 6 }, new Date()),
      ).resolves.toBeUndefined();
    });

    it('upserts the player with the expected payload when a client exists', async () => {
      const service = new PrismaService();
      const client = createMockPrismaClient();
      client.game.upsert.mockResolvedValue(undefined);
      (service as { client: MockPrismaClient | null }).client = client;
      const rules = { maxPlayers: 6 };
      const timestamp = new Date('2024-01-01T00:00:00.000Z');

      await service.upsertPlayer(payload, rules, timestamp);

      expect(client.game.upsert).toHaveBeenCalledWith({
        where: { code: payload.gameCode },
        create: {
          code: payload.gameCode,
          phase: 'lobby',
          rules,
          players: {
            create: {
              externalId: payload.player.id,
              name: payload.player.name,
              color: payload.player.color,
              role: payload.player.role,
              status: 'online',
              territories: 0,
              gameCode: payload.gameCode,
            },
          },
        },
        update: {
          updatedAt: timestamp,
          players: {
            upsert: {
              where: {
                externalId_gameCode: {
                  externalId: payload.player.id,
                  gameCode: payload.gameCode,
                },
              },
              create: {
                externalId: payload.player.id,
                name: payload.player.name,
                color: payload.player.color,
                role: payload.player.role,
                status: 'online',
                territories: 0,
                gameCode: payload.gameCode,
              },
              update: {
                name: payload.player.name,
                color: payload.player.color,
                role: payload.player.role,
                status: 'online',
                gameCode: payload.gameCode,
              },
            },
          },
        },
      });
    });
  });
});
