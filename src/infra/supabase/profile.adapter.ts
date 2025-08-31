import { SupabaseClient } from '@supabase/supabase-js';
import supabase from '../../init/supabase-client.js';
import {
  ProfilePort,
  getProfileInputSchema,
  getProfileOutputSchema,
  updateProfileInputSchema,
  updateProfileOutputSchema
} from '../../shared/ports/profile';

export const createProfileAdapter = (client: SupabaseClient | null = supabase): ProfilePort => {
  const supa = client;
  return {
    async getProfile(input) {
      const { userId } = getProfileInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data, error } = await supa
        .from('profiles')
        .select()
        .eq('user_id', userId)
        .single();
      if (error || !data) throw error || new Error('Profile not found');
      return getProfileOutputSchema.parse({
        userId: data.user_id ?? data.userId,
        name: data.name,
        avatarUrl: data.avatar_url ?? data.avatarUrl
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
          avatar_url: profile.avatarUrl
        })
        .select()
        .single();
      if (error || !data) throw error || new Error('Update profile failed');
      return updateProfileOutputSchema.parse({
        userId: data.user_id ?? data.userId,
        name: data.name,
        avatarUrl: data.avatar_url ?? data.avatarUrl
      });
    }
  };
};

export default createProfileAdapter;
