import Game from '../../src/game.js';
import { REINFORCE, ATTACK, FORTIFY } from '../../src/phases.js';

/**
 * Ensure endTurn moves from attack to fortify and then to the next player's turn.
 */
describe('turn transition', () => {
  const territories = [
    { id: 't1', neighbors: ['t2'], x: 0, y: 0 },
    { id: 't2', neighbors: ['t1'], x: 0, y: 0 },
  ];
  const players = [
    { name: 'P1', color: '#000' },
    { name: 'P2', color: '#111' },
  ];

  test('endTurn advances to next player with reinforcements', () => {
    const game = new Game(players, territories, [], [], false);
    game.setPhase(ATTACK);
    game.reinforcements = 0; // mimic used reinforcements

    game.endTurn();
    expect(game.getPhase()).toBe(FORTIFY);
    expect(game.getCurrentPlayer()).toBe(0);

    game.endTurn();
    expect(game.getPhase()).toBe(REINFORCE);
    expect(game.getCurrentPlayer()).toBe(1);
    expect(game.reinforcements).toBe(3);
  });
});
