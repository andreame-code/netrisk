import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import type { Game, GamePlayer } from '@prisma/client';
import {
  GameState,
  JoinGameRequest,
  createInitialGameState,
} from '@netrisk/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

class InMemoryPrismaServiceStub
  implements
    Pick<
      PrismaService,
      'findLatestGame' | 'upsertPlayer' | 'onModuleInit' | 'onModuleDestroy'
    >
{
  public readonly joins: Array<{
    payload: JoinGameRequest;
    rules: unknown;
    timestamp: Date;
  }> = [];

  private latestGame: (Game & { players: GamePlayer[] }) | null = null;

  async onModuleInit() {}

  async onModuleDestroy() {}

  async findLatestGame(): Promise<(Game & { players: GamePlayer[] }) | null> {
    return this.latestGame;
  }

  async upsertPlayer(
    payload: JoinGameRequest,
    rules: unknown,
    timestamp: Date,
  ): Promise<void> {
    this.joins.push({ payload, rules, timestamp });
    this.latestGame = {
      id: `stub-${timestamp.getTime()}`,
      code: payload.gameCode,
      phase: 'lobby',
      rules,
      createdAt: timestamp,
      updatedAt: timestamp,
      players: [
        {
          id: `stub-player-${timestamp.getTime()}`,
          gameId: `stub-${timestamp.getTime()}`,
          externalId: payload.player.id,
          gameCode: payload.gameCode,
          name: payload.player.name,
          color: payload.player.color,
          role: payload.player.role,
          status: 'online',
          territories: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as GamePlayer,
      ],
    } as Game & { players: GamePlayer[] };
  }
}

describe('GameGateway (e2e)', () => {
  let app: INestApplication;
  let httpServerUrl: string;
  let client: Socket | undefined;
  let prismaStub: InMemoryPrismaServiceStub;

  beforeAll(async () => {
    prismaStub = new InMemoryPrismaServiceStub();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    if (typeof address === 'string' || !address) {
      throw new Error('Failed to determine HTTP server address for tests');
    }

    httpServerUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  });

  afterEach(async () => {
    if (client) {
      await new Promise<void>((resolve) => {
        if (client?.connected) {
          client.once('disconnect', () => resolve());
          client.disconnect();
        } else {
          client.disconnect();
          resolve();
        }
      });
      client.removeAllListeners();
      client = undefined;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('streams lobby updates and echoes join acknowledgements', async () => {
    client = io(httpServerUrl, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    const initialLobbyPromise = new Promise<GameState>((resolve, reject) => {
      client!.once('lobby:update', (state: GameState) => resolve(state));
      client!.once('connect_error', (error) => reject(error));
    });

    await new Promise<void>((resolve, reject) => {
      if (client!.connected) {
        resolve();
        return;
      }

      client!.once('connect', () => resolve());
      client!.once('connect_error', (error) => reject(error));
    });

    const initialState = await initialLobbyPromise;
    const baseline = createInitialGameState('LOBBY');

    expect(initialState).toMatchObject({
      code: baseline.code,
      phase: baseline.phase,
      players: [],
      rules: baseline.rules,
    });
    expect(initialState.id).toEqual(expect.any(String));
    expect(initialState.createdAt).toEqual(expect.any(String));
    expect(initialState.updatedAt).toEqual(initialState.createdAt);

    const lobbyUpdatePromise = new Promise<GameState>((resolve) => {
      client!.once('lobby:update', (state: GameState) => resolve(state));
    });

    const joinPayload: JoinGameRequest = {
      gameCode: 'RISK2024',
      player: {
        id: 'player-123',
        name: 'Strategist',
        color: '#3366ff',
        role: 'defender',
      },
    };

    const joinResponse = await new Promise<GameState>((resolve, reject) => {
      client!.emit('game:join', joinPayload, (state: GameState) =>
        resolve(state),
      );
      client!.once('connect_error', (error) => reject(error));
    });

    const broadcastState = await lobbyUpdatePromise;

    expect(joinResponse.id).toEqual(expect.any(String));
    expect(joinResponse.createdAt).toEqual(expect.any(String));
    expect(new Date(joinResponse.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(initialState.updatedAt).getTime(),
    );
    expect(new Date(joinResponse.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(joinResponse.createdAt).getTime(),
    );
    expect(joinResponse).toMatchObject({
      code: joinPayload.gameCode,
      players: [
        {
          profile: {
            id: joinPayload.player.id,
            name: joinPayload.player.name,
            color: joinPayload.player.color,
            role: joinPayload.player.role,
          },
          status: 'online',
          territories: 0,
        },
      ],
      rules: initialState.rules,
    });

    expect(broadcastState).toEqual(joinResponse);

    expect(prismaStub.joins).toHaveLength(1);
    expect(prismaStub.joins[0].payload).toEqual(joinPayload);
    expect(prismaStub.joins[0].rules).toEqual(joinResponse.rules);
    expect(
      Math.abs(
        prismaStub.joins[0].timestamp.getTime() -
          new Date(joinResponse.updatedAt).getTime(),
      ),
    ).toBeLessThan(1000);
  });
});
