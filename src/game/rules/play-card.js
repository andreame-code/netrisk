export default function playCard(state, indices) {
  const newState = {
    ...state,
    hands: state.hands.map(hand => hand.map(c => ({ ...c }))),
    discard: [...(state.discard || [])],
  };
  const hand = newState.hands[newState.currentPlayer];
  if (!Array.isArray(indices) || indices.length !== 3) {
    return { state: newState, played: false };
  }
  const cards = indices.map(i => hand[i]);
  if (cards.some(c => !c)) {
    return { state: newState, played: false };
  }
  const types = cards.map(c => c.type);
  const allSame = types.every(t => t === types[0]);
  const allDiff = new Set(types).size === 3;
  if (!allSame && !allDiff) {
    return { state: newState, played: false };
  }
  indices
    .sort((a, b) => b - a)
    .forEach(i => newState.discard.push(hand.splice(i, 1)[0]));
  newState.reinforcements = (newState.reinforcements || 0) + 5;
  return { state: newState, played: true, cards };
}
