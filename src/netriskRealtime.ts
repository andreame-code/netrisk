import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import type { GameState, Event } from './types/netrisk';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

export function subscribeToMatch<S extends GameState = GameState, A = unknown, R = unknown>(
  matchId: string,
  handlers: { onState?: (state: S) => void; onEvent?: (ev: Event<A, R>) => void }
) {
  const channel = client.channel(`netrisk:${matchId}`);

  if (handlers.onState) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_states', filter: `match_id=eq.${matchId}` },
      (payload) => handlers.onState?.((payload.new as { state: S }).state)
    );
  }

  if (handlers.onEvent) {
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events', filter: `match_id=eq.${matchId}` },
      (payload) => {
        const row = payload.new as any;
        const ev: Event<A, R> = {
          id: row.id,
          matchId: row.match_id,
          playerId: row.player_id,
          action: row.action,
          result: row.result,
          createdAt: row.created_at,
        };
        handlers.onEvent?.(ev);
      }
    );
  }

  channel.subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
