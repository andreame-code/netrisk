import { SupabaseClient } from "@supabase/supabase-js";
import supabase from "../../init/supabase-client.js";
import {
  AuthPort,
  loginInputSchema,
  loginOutputSchema,
  logoutInputSchema,
  logoutOutputSchema,
  currentUserInputSchema,
  currentUserOutputSchema,
} from "../../shared/ports/auth";

export const createAuthAdapter = (
  client: SupabaseClient | null = supabase,
): AuthPort => {
  const supa = client;
  return {
    async login(input) {
      const { email, password } = loginInputSchema.parse(input);
      if (!supa) throw new Error("Supabase client not initialized");
      const { data, error } = await supa.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session || !data.user)
        throw error || new Error("Invalid login response");
      return loginOutputSchema.parse({
        userId: data.user.id,
        token: data.session.access_token,
      });
    },
    async logout(input) {
      logoutInputSchema.parse(input);
      if (!supa) throw new Error("Supabase client not initialized");
      const { error } = await supa.auth.signOut();
      if (error) throw error;
      return logoutOutputSchema.parse({});
    },
    async currentUser(input) {
      currentUserInputSchema.parse(input);
      if (!supa) throw new Error("Supabase client not initialized");
      const { data, error } = await supa.auth.getSession();
      if (error || !data.session) throw error || new Error("No session");
      let user = (data.session as any).user;
      if (!user && typeof supa.auth.getUser === "function") {
        const { data: userData } = await supa.auth.getUser();
        user = userData?.user;
      }
      if (!user) throw new Error("No session");
      const meta = user.user_metadata as any;
      return currentUserOutputSchema.parse({
        id: user.id || "",
        email: user.email ?? undefined,
        name: meta?.name || meta?.username,
      });
    },
  };
};

export default createAuthAdapter;
