import Game from '../src/game.js';
import { FORTIFY } from '../src/phases.js';

describe('undo functionality', () => {
  const createGame = (maxUndo = 10) => {
    const territories = [
      { id: 'a', neighbors: ['b'], owner: 0, armies: 5 },
      { id: 'b', neighbors: ['a'], owner: 0, armies: 1 },
    ];
    return new Game([{ name: 'P1' }, { name: 'P2' }], territories, [], [], false, false, maxUndo);
  };

  test('undo and redo reinforcement', () => {
    const game = createGame();
    game.reinforcements = 2;
    game.handleTerritoryClick('a');
    expect(game.territories[0].armies).toBe(6);
    expect(game.reinforcements).toBe(1);
    expect(game.canUndo()).toBe(true);
    game.undo();
    expect(game.territories[0].armies).toBe(5);
    expect(game.reinforcements).toBe(2);
    game.redo();
    expect(game.territories[0].armies).toBe(6);
    expect(game.reinforcements).toBe(1);
  });

  test('undo not available outside reinforcement', () => {
    const game = createGame();
    game.setPhase(FORTIFY);
    game.moveArmies('a', 'b', 3);
    expect(game.territories[0].armies).toBe(2);
    expect(game.territories[1].armies).toBe(4);
    expect(game.canUndo()).toBe(false);
    const result = game.undo();
    expect(result).toBe(false);
    expect(game.territories[0].armies).toBe(2);
    expect(game.territories[1].armies).toBe(4);
  });

  test('undo stack limit', () => {
    const game = createGame(2);
    game.reinforcements = 4;
    game.handleTerritoryClick('a'); // 6
    game.handleTerritoryClick('a'); // 7
    game.handleTerritoryClick('a'); // 8 (first state dropped)
    expect(game.territories[0].armies).toBe(8);
    game.undo(); // 7
    game.undo(); // 6, cannot undo to 5
    expect(game.territories[0].armies).toBe(6);
    expect(game.canUndo()).toBe(false);
  });
});
