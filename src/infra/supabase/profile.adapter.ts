import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import supabase from '../../init/supabase-client.js';
import {
  ProfilePort,
  getProfileInputSchema,
  getProfileOutputSchema,
  updateProfileInputSchema,
  updateProfileOutputSchema,
} from '../../shared/ports/profile';

export const createProfileAdapter = (client: SupabaseClient | null = supabase): ProfilePort => {
  const supa = client;
  return {
    async getProfile(input) {
      const { userId } = getProfileInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data, error } = await supa.from('profiles').select().eq('user_id', userId).single();
      if (error || !data) throw error || new Error('Profile not found');
      const row = z
        .object({
          user_id: z.string().optional(),
          userId: z.string().optional(),
          name: z.string().optional().nullable(),
          avatar_url: z.string().url().optional().nullable(),
          avatarUrl: z.string().url().optional().nullable(),
        })
        .parse(data);
      return getProfileOutputSchema.parse({
        userId: row.userId ?? (row as any).user_id,
        name: row.name ?? undefined,
        avatarUrl: row.avatarUrl ?? row.avatar_url ?? undefined,
      });
    },
    async updateProfile(input) {
      const profile = updateProfileInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data, error } = await supa
        .from('profiles')
        .upsert({
          user_id: profile.userId,
          name: profile.name,
          avatar_url: profile.avatarUrl,
        })
        .select()
        .single();
      if (error || !data) throw error || new Error('Update profile failed');
      const row = z
        .object({
          user_id: z.string().optional(),
          userId: z.string().optional(),
          name: z.string().optional().nullable(),
          avatar_url: z.string().url().optional().nullable(),
          avatarUrl: z.string().url().optional().nullable(),
        })
        .parse(data);
      return updateProfileOutputSchema.parse({
        userId: row.userId ?? (row as any).user_id,
        name: row.name ?? undefined,
        avatarUrl: row.avatarUrl ?? row.avatar_url ?? undefined,
      });
    },
  };
};

export default createProfileAdapter;
