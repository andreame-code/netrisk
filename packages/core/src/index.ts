export * from './dto/index.js';
export * from './models/game.js';
export * from './models/player.js';
export * from './rules/gameRules.js';
export * from './schemas/game.js';

export function createInitialGameState(
  code: string,
  createdAt = new Date(),
): import('./models/game.js').GameState {
  const timestamp = createdAt.toISOString();
  return {
    id: crypto.randomUUID(),
    code,
    phase: 'lobby',
    players: [],
    rules: { ...defaultGameRules },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

import { defaultGameRules } from './rules/gameRules.js';
