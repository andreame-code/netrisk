export interface Match {
  id: string;
  status: string;
  createdAt: string;
}

export interface Player {
  id: string;
  matchId?: string;
  name?: string;
  color?: string;
  createdAt?: string;
}

export interface GameState {
  [key: string]: unknown;
}

export interface Event<TAction = unknown, TResult = unknown> {
  id: string;
  matchId: string;
  playerId: string;
  action: TAction;
  result: TResult;
  createdAt: string;
}
