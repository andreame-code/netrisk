import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdrfohrmfppyzzywhmsn.supabase.co';
const anonKey = process.env.SUPABASE_KEY || '';
const client = createClient(supabaseUrl, anonKey);

export function subscribeToMatch(
  matchId: string,
  handlers: { onState?: (state: any) => void; onEvent?: (ev: any) => void }
) {
  const channel = client.channel(`netrisk:${matchId}`);

  if (handlers.onState) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_states', filter: `match_id=eq.${matchId}` },
      payload => handlers.onState?.(payload.new.state)
    );
  }

  if (handlers.onEvent) {
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events', filter: `match_id=eq.${matchId}` },
      payload => handlers.onEvent?.(payload.new)
    );
  }

  channel.subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
