import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import type { Match, Player, GameState, Event } from './types/netrisk';

// Request/response types for the NetRisk API
export interface CreateMatchRequest {
  action: 'create_match';
  player: Player;
}
export type CreateMatchResponse = Match;

export interface JoinMatchRequest {
  action: 'join_match';
  matchId: string;
  player: Player;
}
export type JoinMatchResponse = Match;

export interface StartMatchRequest {
  action: 'start_match';
  matchId: string;
}
export type StartMatchResponse = GameState;

export interface ActionRequest<TAction extends Record<string, unknown>> {
  action: 'action';
  matchId: string;
  playerId: string;
  payload: TAction;
}
export type ActionResponse<TAction, TResult> = Event<TAction, TResult>;

const functionUrl = `${SUPABASE_URL}/functions/v1/netrisk`;

async function call<TResponse, TBody extends object>(body: TBody): Promise<TResponse> {
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const createMatch = (player: Player) =>
  call<CreateMatchResponse, CreateMatchRequest>({ action: 'create_match', player });

export const joinMatch = (matchId: string, player: Player) =>
  call<JoinMatchResponse, JoinMatchRequest>({ action: 'join_match', matchId, player });

export const startMatch = (matchId: string) =>
  call<StartMatchResponse, StartMatchRequest>({ action: 'start_match', matchId });

export const sendAction = <TAction extends Record<string, unknown>, TResult = unknown>(
  matchId: string,
  playerId: string,
  payload: TAction
) =>
  call<ActionResponse<TAction, TResult>, ActionRequest<TAction>>({
    action: 'action',
    matchId,
    playerId,
    payload,
  });

export default { createMatch, joinMatch, startMatch, sendAction };
