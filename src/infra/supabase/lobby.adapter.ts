import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
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
  leaveLobbyOutputSchema,
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
      const row = z
        .object({
          id: z.string().optional(),
          code: z.string().optional(),
          name: z.string(),
          max_players: z.number().int().positive().optional(),
          maxPlayers: z.number().int().positive().optional(),
        })
        .parse(data);
      return createLobbyOutputSchema.parse({
        id: row.id ?? row.code,
        name: row.name,
        maxPlayers: row.max_players ?? row.maxPlayers,
      });
    },
    async listLobbies(input) {
      listLobbiesInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data, error } = await supa.from('lobbies').select();
      if (error || !data) throw error || new Error('List lobbies failed');
      const lobbies = data.map((row: any) =>
        lobbySchema.parse({
          id: row.code ?? row.id,
          name: row.host ?? row.name,
          maxPlayers: row.max_players ?? row.maxPlayers,
          playerCount: Array.isArray(row.players)
            ? row.players.length
            : (row.player_count ?? row.playerCount),
        }),
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
  };
};

export default createLobbyAdapter;
