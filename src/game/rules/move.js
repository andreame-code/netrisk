export default function move(state, fromId, toId, count) {
  const newState = {
    ...state,
    territories: state.territories.map((t) => ({ ...t })),
  };
  const from = newState.territories.find((t) => t.id === fromId);
  const to = newState.territories.find((t) => t.id === toId);
  if (!from || !to) {
    return { state: newState, moved: false };
  }
  if (
    from.owner !== newState.currentPlayer ||
    to.owner !== newState.currentPlayer
  ) {
    return { state: newState, moved: false };
  }
  if (!from.neighbors.includes(to.id)) {
    return { state: newState, moved: false };
  }
  if (count < 1 || from.armies <= count) {
    return { state: newState, moved: false };
  }
  from.armies -= count;
  to.armies += count;
  return { state: newState, moved: true };
}
