import { z } from "zod";

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export const loginOutputSchema = z.object({
  userId: z.string(),
  token: z.string(),
});
export type LoginInputDto = z.infer<typeof loginInputSchema>;
export type LoginOutputDto = z.infer<typeof loginOutputSchema>;

export const logoutInputSchema = z.object({});
export const logoutOutputSchema = z.object({});
export type LogoutInputDto = z.infer<typeof logoutInputSchema>;
export type LogoutOutputDto = z.infer<typeof logoutOutputSchema>;

export const currentUserInputSchema = z.object({});
export const currentUserOutputSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});
export type CurrentUserInputDto = z.infer<typeof currentUserInputSchema>;
export type CurrentUserOutputDto = z.infer<typeof currentUserOutputSchema>;

export interface AuthPort {
  login(input: LoginInputDto): Promise<LoginOutputDto>;
  logout(input: LogoutInputDto): Promise<LogoutOutputDto>;
  currentUser(input: CurrentUserInputDto): Promise<CurrentUserOutputDto>;
}
