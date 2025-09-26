import { Injectable } from '@nestjs/common';
import { GameService } from './game/game.service';
import type { GameState } from '@netrisk/core';

export interface HealthResponse {
  status: 'ok';
  lobby: GameState;
}

@Injectable()
export class AppService {
  constructor(private readonly gameService: GameService) {}

  async getHealth(): Promise<HealthResponse> {
    const lobby = await this.gameService.getLobbyState();
    return {
      status: 'ok',
      lobby,
    };
  }
}
