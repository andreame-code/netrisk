export default function reinforce(state, territoryId) {
  const newState = {
    ...state,
    territories: state.territories.map(t => ({ ...t })),
  };
  if (newState.reinforcements <= 0) {
    return { state: newState };
  }
  const territory = newState.territories.find(t => t.id === territoryId);
  if (!territory || territory.owner !== newState.currentPlayer) {
    return { state: newState };
  }
  territory.armies += 1;
  newState.reinforcements -= 1;
  return { state: newState };
}
