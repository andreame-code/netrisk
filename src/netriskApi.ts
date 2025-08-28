import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import type { Match, Player, GameState, Event } from './types/netrisk';

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
  call<Match, { action: string; player: Player }>({ action: 'create_match', player });

export const joinMatch = (matchId: string, player: Player) =>
  call<Match, { action: string; matchId: string; player: Player }>({
    action: 'join_match',
    matchId,
    player,
  });

export const startMatch = (matchId: string) =>
  call<GameState, { action: string; matchId: string }>({ action: 'start_match', matchId });

export const sendAction = <TAction extends Record<string, unknown>, TResult = unknown>(
  matchId: string,
  playerId: string,
  payload: TAction
) =>
  call<Event<TAction, TResult>, { action: string; matchId: string; playerId: string; payload: TAction }>(
    { action: 'action', matchId, playerId, payload }
  );

export default { createMatch, joinMatch, startMatch, sendAction };
