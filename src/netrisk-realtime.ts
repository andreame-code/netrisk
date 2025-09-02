import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import type { GameState, Event } from './types/netrisk';
import { deserialize as deserializeGameState } from './game/state/index.js';

// Types for realtime subscription requests and payloads
export interface MatchSubscriptionHandlers<S extends GameState, A, R> {
  onState?: (state: S) => void;
  onEvent?: (ev: Event<A, R>) => void;
}

interface RealtimePayload<T> {
  new: T;
}

// Initialize Supabase client only when URL and key are available.
// Read from config constants first but allow runtime overrides via
// `window.__env` to support deployments where values are injected at
// runtime instead of build time.
export const client = (() => {
  const url =
    SUPABASE_URL || (typeof window !== 'undefined' && (window as any).__env?.SUPABASE_URL) || '';
  const key =
    SUPABASE_KEY ||
    (typeof window !== 'undefined' && (window as any).__env?.SUPABASE_ANON_KEY) ||
    '';

  if (!url || !key) {
    console.warn('[Supabase] missing URL or anon key – realtime disabled');
    return null;
  }

  return createClient(url, key);
})();

export function subscribeToMatch<S extends GameState = GameState, A = unknown, R = unknown>(
  matchId: string,
  handlers: MatchSubscriptionHandlers<S, A, R>,
) {
  if (!client) {
    console.warn('[Supabase] subscribeToMatch called without client – ignoring');
    return () => {};
  }

  const channel = client.channel(`netrisk:${matchId}`);

  if (handlers.onState) {
    (channel as any).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_states',
        filter: `match_id=eq.${matchId}`,
      },
      (payload: RealtimePayload<{ state: S }>) =>
        handlers.onState?.(deserializeGameState(payload.new.state) as unknown as S),
    );
  }

  if (handlers.onEvent) {
    (channel as any).on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'events',
        filter: `match_id=eq.${matchId}`,
      },
      (payload: RealtimePayload<Event<A, R>>) => handlers.onEvent?.(payload.new),
    );
  }

  channel.subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
