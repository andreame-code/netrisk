export type PlayerRole = 'attacker' | 'defender' | 'observer';

export type PlayerStatus = 'online' | 'disconnected';

export interface PlayerProfile {
  id: string;
  name: string;
  color: string;
  role: PlayerRole;
}

export interface PlayerState {
  profile: PlayerProfile;
  status: PlayerStatus;
  territories: number;
}
