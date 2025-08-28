const { getLevelObstacles, levelObstacles } = require('../src/data/level-obstacles.js');

describe('getLevelObstacles UAT', () => {
  const knownLevels = Object.keys(levelObstacles);

  test.each(knownLevels)('returns configured obstacles for %s', level => {
    expect(getLevelObstacles(level)).toEqual(levelObstacles[level]);
  });

  test('returns empty obstacle list for unknown level', () => {
    const obstacles = getLevelObstacles('unknown-level');
    expect(obstacles).toEqual({
      purpleBrambles: undefined,
      moonMilk: undefined,
      seedWalls: undefined,
    });
  });
});

