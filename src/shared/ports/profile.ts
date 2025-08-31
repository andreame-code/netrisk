import { z } from 'zod';

export const getProfileInputSchema = z.object({
  userId: z.string()
});
export const profileSchema = z.object({
  userId: z.string(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional()
});
export const getProfileOutputSchema = profileSchema;
export type GetProfileInputDto = z.infer<typeof getProfileInputSchema>;
export type GetProfileOutputDto = z.infer<typeof getProfileOutputSchema>;

export const updateProfileInputSchema = profileSchema;
export const updateProfileOutputSchema = profileSchema;
export type UpdateProfileInputDto = z.infer<typeof updateProfileInputSchema>;
export type UpdateProfileOutputDto = z.infer<typeof updateProfileOutputSchema>;

export interface ProfilePort {
  getProfile(input: GetProfileInputDto): Promise<GetProfileOutputDto>;
  updateProfile(input: UpdateProfileInputDto): Promise<UpdateProfileOutputDto>;
}
