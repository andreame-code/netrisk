export default function attack(state, fromId, toId) {
  const newState = {
    ...state,
    territories: state.territories.map((t) => ({ ...t })),
  };
  const from = newState.territories.find((t) => t.id === fromId);
  const to = newState.territories.find((t) => t.id === toId);
  if (!from || !to || from.owner === to.owner) {
    return { state: newState, result: null };
  }
  const attackDice = Math.min(3, from.armies - 1);
  const defendDice = Math.min(2, to.armies);
  const roll = () => Math.ceil(Math.random() * 6);
  const attackRolls = Array.from({ length: attackDice }, () => roll()).sort((a, b) => b - a);
  const defendRolls = Array.from({ length: defendDice }, () => roll()).sort((a, b) => b - a);
  const comparisons = Math.min(attackRolls.length, defendRolls.length);
  let attackerLosses = 0;
  let defenderLosses = 0;
  for (let i = 0; i < comparisons; i++) {
    if (attackRolls[i] > defendRolls[i]) {
      to.armies -= 1;
      defenderLosses += 1;
    } else {
      from.armies -= 1;
      attackerLosses += 1;
    }
  }
  let conquered = false;
  let movableArmies = 0;
  if (to.armies <= 0) {
    to.owner = from.owner;
    to.armies = 1;
    from.armies -= 1;
    conquered = true;
    movableArmies = from.armies - 1;
  }
  return {
    state: newState,
    result: {
      attackRolls,
      defendRolls,
      conquered,
      movableArmies,
      attackerLosses,
      defenderLosses,
    },
  };
}
