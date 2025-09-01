import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
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
      if (error || !data) throw error || new Error("Invalid login response");
      const parsed = z
        .object({
          user: z.object({ id: z.string() }),
          session: z.object({ access_token: z.string() }),
        })
        .parse(data);
      return loginOutputSchema.parse({
        userId: parsed.user.id,
        token: parsed.session.access_token,
      });
    },
    async logout(input) {
      logoutInputSchema.parse(input);
      if (!supa) throw new Error("Supabase client not initialized");
      const { error } = await supa.auth.signOut({ scope: "global" });
      if (error) throw error;
      return logoutOutputSchema.parse({});
    },
    async currentUser(input) {
      currentUserInputSchema.parse(input);
      if (!supa) throw new Error("Supabase client not initialized");
      const { data, error } = await supa.auth.getSession();
      if (error || !data?.session) throw error || new Error("No session");
      let user = (data.session as any).user;
      if (!user && typeof supa.auth.getUser === "function") {
        const { data: userData } = await supa.auth.getUser();
        user = userData?.user;
      }
      const parsedUser = z
        .object({
          id: z.string(),
          email: z.string().email().nullish(),
          user_metadata: z.record(z.string(), z.any()).optional(),
        })
        .parse(user);
      const meta = parsedUser.user_metadata as any;
      return currentUserOutputSchema.parse({
        id: parsedUser.id,
        email: parsedUser.email ?? undefined,
        name: meta?.name || meta?.username,
      });
    },
  };
};

export default createAuthAdapter;
