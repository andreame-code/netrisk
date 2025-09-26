import { Injectable, Logger } from '@nestjs/common';
import {
  JoinGameRequest,
  GameState,
  createInitialGameState,
  joinGameRequestSchema,
} from '@netrisk/core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getLobbyState(): Promise<GameState> {
    try {
      const latest = await this.prisma.findLatestGame();

      if (latest) {
        return {
          id: latest.id,
          code: latest.code,
          phase: latest.phase as GameState['phase'],
          players: latest.players.map((player) => ({
            profile: {
              id: player.externalId,
              name: player.name,
              color: player.color,
              role: player.role as 'attacker' | 'defender' | 'observer',
            },
            status: player.status as 'online' | 'disconnected',
            territories: player.territories,
          })),
          rules: latest.rules as GameState['rules'],
          createdAt: latest.createdAt.toISOString(),
          updatedAt: latest.updatedAt.toISOString(),
        };
      }
    } catch (error) {
      this.logger.debug(
        `Falling back to generated lobby state: ${(error as Error).message}`,
      );
    }

    return createInitialGameState('LOBBY');
  }

  async recordJoin(request: JoinGameRequest): Promise<GameState> {
    const payload = joinGameRequestSchema.parse(request);
    const existingState = await this.getLobbyState();
    const now = new Date();

    try {
      await this.prisma.upsertPlayer(payload, existingState.rules, now);
    } catch (error) {
      this.logger.debug(
        `Skipping persistence for join event: ${(error as Error).message}`,
      );
    }

    const players = existingState.players.filter(
      (player) => player.profile.id !== payload.player.id,
    );
    players.push({
      profile: payload.player,
      status: 'online',
      territories: 0,
    });

    return {
      ...existingState,
      code: payload.gameCode,
      players,
      updatedAt: now.toISOString(),
    };
  }
}
