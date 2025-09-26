import type { GameRules } from '../rules/gameRules.js';
import type { PlayerState } from './player.js';

export type GamePhase = 'lobby' | 'deployment' | 'battle' | 'completed';

export interface GameState {
  id: string;
  code: string;
  phase: GamePhase;
  players: PlayerState[];
  rules: GameRules;
  createdAt: string;
  updatedAt: string;
}

export interface GameSummary {
  id: string;
  code: string;
  phase: GamePhase;
  playerCount: number;
  maxPlayers: number;
}
