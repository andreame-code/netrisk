import type { GameState } from '../models/game.js';
import type { PlayerProfile } from '../models/player.js';

export interface JoinGameRequest {
  gameCode: string;
  player: PlayerProfile;
}

export interface JoinGameResponse {
  game: GameState;
}
