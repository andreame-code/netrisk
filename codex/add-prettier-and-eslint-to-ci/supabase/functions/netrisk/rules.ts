export interface Player {
  id: string;
  name?: string;
  color?: string;
}

export interface GameState {
  players: Player[];
  phase: "lobby" | "active";
  currentPlayer: string | null;
  log: any[];
}

export function initialState(players: Player[]): GameState {
  return {
    players: players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    phase: "lobby",
    currentPlayer: null,
    log: [],
  };
}

export interface Action {
  type: string;
  [key: string]: any;
}

export function applyAction(
  state: GameState,
  action: Action,
): { state: GameState; result: any } {
  switch (action.type) {
    case "attack": {
      const roll = Math.ceil(Math.random() * 6);
      const result = { ...action, roll };
      return {
        state: { ...state, log: [...state.log, result] },
        result,
      };
    }
    default:
      return { state, result: null };
  }
}

export function publicState(state: GameState): GameState {
  return state;
}
