import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Game, GamePlayer, PrismaClient } from '@prisma/client';
import type { JoinGameRequest } from '@netrisk/core';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client: PrismaClient | null = null;

  async onModuleInit() {
    try {
      const { PrismaClient } = await import('@prisma/client');
      this.client = new PrismaClient({
        log: ['warn', 'error'],
      });
      await this.client.$connect();
    } catch (error) {
      this.logger.debug(
        `Database connection skipped: ${(error as Error).message}`,
      );
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (!this.client) {
      return;
    }

    await this.client.$disconnect();
  }

  private get prisma(): PrismaClient | null {
    return this.client;
  }

  async findLatestGame(): Promise<(Game & { players: GamePlayer[] }) | null> {
    if (!this.prisma) {
      return null;
    }

    return this.prisma.game.findFirst({
      orderBy: { updatedAt: 'desc' },
      include: { players: true },
    });
  }

  async upsertPlayer(
    payload: JoinGameRequest,
    rules: unknown,
    timestamp: Date,
  ): Promise<void> {
    if (!this.prisma) {
      return;
    }

    await this.prisma.game.upsert({
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
  }
}
