import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import type { GameState, Event } from "./types/netrisk";

// Types for realtime subscription requests and payloads
export interface MatchSubscriptionHandlers<S extends GameState, A, R> {
  onState?: (state: S) => void;
  onEvent?: (ev: Event<A, R>) => void;
}

interface RealtimePayload<T> {
  new: T;
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

export function subscribeToMatch<
  S extends GameState = GameState,
  A = unknown,
  R = unknown,
>(matchId: string, handlers: MatchSubscriptionHandlers<S, A, R>) {
  const channel = client.channel(`netrisk:${matchId}`);

  if (handlers.onState) {
    (channel as any).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_states",
        filter: `match_id=eq.${matchId}`,
      },
      (payload: RealtimePayload<{ state: S }>) =>
        handlers.onState?.(payload.new.state),
    );
  }

  if (handlers.onEvent) {
    (channel as any).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "events",
        filter: `match_id=eq.${matchId}`,
      },
      (payload: RealtimePayload<Event<A, R>>) =>
        handlers.onEvent?.(payload.new),
    );
  }

  channel.subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
