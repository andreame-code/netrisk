export const levelObstacles = {
  map: {},
  map2: {},
  map3: {
    purpleBrambles: { damage: 'instant' },
    moonMilk: { respawn: 'checkpoint' },
    seedWalls: { destructibleWith: 'shield' },
  },
  'map-roman': {},
};

export function getLevelObstacles(levelId) {
  return (
    levelObstacles[levelId] || {
      purpleBrambles: undefined,
      moonMilk: undefined,
      seedWalls: undefined,
    }
  );
}
