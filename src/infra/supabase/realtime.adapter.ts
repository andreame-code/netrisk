import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../../init/supabase-client.js";
import {
  RealtimePort,
  subscribeInputSchema,
  subscribeOutputSchema,
  unsubscribeInputSchema,
  unsubscribeOutputSchema,
} from "../../shared/ports/realtime";

export const createRealtimeAdapter = (
  client: SupabaseClient | null = supabase,
): RealtimePort => {
  if (!client) throw new Error("Supabase client not initialized");
  const channels = new Map<string, RealtimeChannel>();

  return {
    async subscribe(input) {
      const { channel, event, schema, table, callback } =
        subscribeInputSchema.parse(input);
      const ch = client
        .channel(channel)
        .on(
          "postgres_changes",
          { event, schema, table },
          callback as any,
        );
      await ch.subscribe();
      const id = globalThis.crypto.randomUUID();
      channels.set(id, ch);
      return subscribeOutputSchema.parse({ subscriptionId: id });
    },
    async unsubscribe(input) {
      const { subscriptionId } = unsubscribeInputSchema.parse(input);
      const ch = channels.get(subscriptionId);
      if (!ch) {
        return unsubscribeOutputSchema.parse({ success: false });
      }
      await client.removeChannel(ch);
      channels.delete(subscriptionId);
      return unsubscribeOutputSchema.parse({ success: true });
    },
  };
};

export default createRealtimeAdapter;
