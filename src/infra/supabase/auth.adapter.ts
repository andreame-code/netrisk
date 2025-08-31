import { SupabaseClient } from '@supabase/supabase-js';
import supabase from '../../init/supabase-client.js';
import {
  AuthPort,
  loginInputSchema,
  loginOutputSchema,
  logoutInputSchema,
  logoutOutputSchema,
  currentUserInputSchema,
  currentUserOutputSchema,
  sessionInputSchema,
  sessionOutputSchema
} from '../../shared/ports/auth';

export const createAuthAdapter = (client: SupabaseClient | null = supabase): AuthPort => {
  const supa = client;
  return {
    async session(input) {
      sessionInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data } = await supa.auth.getSession();
      return sessionOutputSchema.parse({ exists: !!(data && data.session) });
    },
    async login(input) {
      const { email, password } = loginInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data, error } = await supa.auth.signInWithPassword({ email, password });
      if (error || !data.session || !data.user) throw error || new Error('Invalid login response');
      return loginOutputSchema.parse({
        userId: data.user.id,
        token: data.session.access_token
      });
    },
    async logout(input) {
      logoutInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { error } = await supa.auth.signOut({ scope: 'global' });
      if (error) throw error;
      return logoutOutputSchema.parse({});
    },
    async currentUser(input) {
      currentUserInputSchema.parse(input);
      if (!supa) throw new Error('Supabase client not initialized');
      const { data, error } = (await supa.auth.getSession()) as any;
      let user = data?.session?.user ?? undefined;
      if (!user && typeof supa.auth.getUser === 'function') {
        const { data: uData } = await supa.auth.getUser();
        user = uData.user ?? undefined;
      }
      if (error || !user) throw error || new Error('No user');
      return currentUserOutputSchema.parse({
        id: user.id ?? '',
        email: user.email ?? undefined,
        name:
          (user.user_metadata as any)?.full_name ||
          (user.user_metadata as any)?.name ||
          (user.user_metadata as any)?.username
      });
    }
  };
};

export default createAuthAdapter;
