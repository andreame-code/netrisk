export function attackSuccessProbability(from, to) {
  const attack = from.armies - 1;
  const defend = to.armies;
  if (attack <= 0) return 0;
  const attackPower = attack;
  const defensePower = defend * 1.5; // defense advantage
  return attackPower / (attackPower + defensePower);
}

export function territoryPriority(game, territory) {
  const enemyNeighbors = territory.neighbors.filter(id => {
    const neighbor = game.territoryById(id);
    return neighbor && neighbor.owner !== territory.owner;
  }).length;
  return enemyNeighbors * 10 - territory.armies;
}

