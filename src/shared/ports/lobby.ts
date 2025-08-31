import { z } from 'zod';

export const createLobbyInputSchema = z.object({
  name: z.string(),
  maxPlayers: z.number().int().positive()
});
export const createLobbyOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  maxPlayers: z.number().int().positive()
});
export type CreateLobbyInputDto = z.infer<typeof createLobbyInputSchema>;
export type CreateLobbyOutputDto = z.infer<typeof createLobbyOutputSchema>;

export const listLobbiesInputSchema = z.object({});
export const lobbySchema = z.object({
  id: z.string(),
  name: z.string(),
  maxPlayers: z.number().int().positive(),
  playerCount: z.number().int().nonnegative()
});
export const listLobbiesOutputSchema = z.object({
  lobbies: z.array(lobbySchema)
});
export type ListLobbiesInputDto = z.infer<typeof listLobbiesInputSchema>;
export type ListLobbiesOutputDto = z.infer<typeof listLobbiesOutputSchema>;

export const joinLobbyInputSchema = z.object({
  lobbyId: z.string()
});
export const joinLobbyOutputSchema = z.object({
  lobbyId: z.string()
});
export type JoinLobbyInputDto = z.infer<typeof joinLobbyInputSchema>;
export type JoinLobbyOutputDto = z.infer<typeof joinLobbyOutputSchema>;

export const leaveLobbyInputSchema = z.object({
  lobbyId: z.string()
});
export const leaveLobbyOutputSchema = z.object({
  lobbyId: z.string()
});
export type LeaveLobbyInputDto = z.infer<typeof leaveLobbyInputSchema>;
export type LeaveLobbyOutputDto = z.infer<typeof leaveLobbyOutputSchema>;

export interface LobbyPort {
  createLobby(input: CreateLobbyInputDto): Promise<CreateLobbyOutputDto>;
  listLobbies(input: ListLobbiesInputDto): Promise<ListLobbiesOutputDto>;
  join(input: JoinLobbyInputDto): Promise<JoinLobbyOutputDto>;
  leave(input: LeaveLobbyInputDto): Promise<LeaveLobbyOutputDto>;
}
