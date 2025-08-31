import { SupabaseClient } from '@supabase/supabase-js';
import supabase from '../../init/supabase-client.js';
import {
  LobbyPort,
  createLobbyInputSchema,
  createLobbyOutputSchema,
  listLobbiesInputSchema,
  listLobbiesOutputSchema,
  lobbySchema,
  joinLobbyInputSchema,
  joinLobbyOutputSchema,
  leaveLobbyInputSchema,
  leaveLobbyOutputSchema
} from '../../shared/ports/lobby';

export const createLobbyAdapter = (client: SupabaseClient | null = supabase): LobbyPort => {
  const supa = client;
  return {
    async createLobby(input) {
      const { name, maxPlayers } = createLobbyInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data, error } = await supa
        .from('lobbies')
        .insert({ name, max_players: maxPlayers })
        .select()
        .single();
      if (error || !data) throw error || new Error('Create lobby failed');
      return createLobbyOutputSchema.parse({
        id: data.id ?? data.code ?? '',
        name: data.name,
        maxPlayers: data.max_players ?? data.maxPlayers
      });
    },
    async listLobbies(input) {
      listLobbiesInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data, error } = await supa.from('lobbies').select();
      if (error || !data) throw error || new Error('List lobbies failed');
      const lobbies = data.map((row: any) =>
        lobbySchema.parse({
          id: row.id ?? row.code ?? '',
          name: row.name,
          maxPlayers: row.max_players ?? row.maxPlayers,
          playerCount: row.player_count ?? row.playerCount ?? 0
        })
      );
      return listLobbiesOutputSchema.parse({ lobbies });
    },
    async join(input) {
      const { lobbyId } = joinLobbyInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { error } = await supa.rpc('join_lobby', { lobby_id: lobbyId });
      if (error) throw error;
      return joinLobbyOutputSchema.parse({ lobbyId });
    },
    async leave(input) {
      const { lobbyId } = leaveLobbyInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { error } = await supa.rpc('leave_lobby', { lobby_id: lobbyId });
      if (error) throw error;
      return leaveLobbyOutputSchema.parse({ lobbyId });
    },
    subscribeToLobbyChanges(onChange) {
      if (!supa) return () => {};
      const channel = supa
        .channel('public:lobbies')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, () => {
          onChange();
        })
        .subscribe();
      return () => {
        try {
          channel.unsubscribe();
        } catch {
          // ignore unsubscribe errors
        }
      };
    }
  };
};

export default createLobbyAdapter;
