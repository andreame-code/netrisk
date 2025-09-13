export function createGameState(players) {
  return { turn: 0, players, moves: [] }
}

export function recordMove(state, move) {
  return { ...state, moves: [...state.moves, move], turn: state.turn + 1 }
}
