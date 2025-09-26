import { z } from 'zod';
import { defaultGameRules } from '../rules/gameRules.js';
import type { GameRules } from '../rules/gameRules.js';

export const playerProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/)
    .default('#3366ff'),
  role: z.enum(['attacker', 'defender', 'observer']).default('attacker'),
});

export const playerStateSchema = z.object({
  profile: playerProfileSchema,
  status: z.enum(['online', 'disconnected']).default('online'),
  territories: z.number().int().nonnegative().default(0),
});

export const joinGameRequestSchema = z.object({
  gameCode: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9]+$/, 'Game codes must be uppercase alphanumeric'),
  player: playerProfileSchema,
});

export const gameRulesSchema: z.ZodType<GameRules> = z.object({
  minPlayers: z.number().int().min(2),
  maxPlayers: z.number().int().max(8),
  reinforcement: z.object({
    minimum: z.number().int().min(1),
    territoryDivisor: z.number().int().min(1),
  }),
  battle: z.object({
    maxAttackerDice: z.number().int().min(1).max(3),
    maxDefenderDice: z.number().int().min(1).max(2),
  }),
});

export const gameStateSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(4),
  phase: z.enum(['lobby', 'deployment', 'battle', 'completed']),
  players: z.array(playerStateSchema),
  rules: gameRulesSchema.default(defaultGameRules),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PlayerProfileInput = z.infer<typeof playerProfileSchema>;
export type JoinGameRequestInput = z.infer<typeof joinGameRequestSchema>;
