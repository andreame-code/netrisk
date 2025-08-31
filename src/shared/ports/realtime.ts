import { z } from "zod";

export const subscribeInputSchema = z.object({
  channel: z.string(),
});
export const subscribeOutputSchema = z.object({
  subscriptionId: z.string(),
});
export type SubscribeInputDto = z.infer<typeof subscribeInputSchema>;
export type SubscribeOutputDto = z.infer<typeof subscribeOutputSchema>;

export const unsubscribeInputSchema = z.object({
  subscriptionId: z.string(),
});
export const unsubscribeOutputSchema = z.object({
  success: z.boolean(),
});
export type UnsubscribeInputDto = z.infer<typeof unsubscribeInputSchema>;
export type UnsubscribeOutputDto = z.infer<typeof unsubscribeOutputSchema>;

export interface RealtimePort {
  subscribe(input: SubscribeInputDto): Promise<SubscribeOutputDto>;
  unsubscribe(input: UnsubscribeInputDto): Promise<UnsubscribeOutputDto>;
}
