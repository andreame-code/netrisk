/**
 * @jest-environment jsdom
 */
let Game, game;

beforeEach(() => {
  jest.resetModules();
  Game = require('./game');
  game = new Game();
});

test('reinforce phase allows adding army and moves to attack', () => {
  const initial = game.territories[0].armies;
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  expect(game.territories[0].armies).toBe(initial + 3);
  expect(game.getPhase()).toBe('attack');
});

test('attack phase resolves battle between territories', () => {
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  jest.spyOn(Math, 'random')
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.5)
    .mockReturnValueOnce(0.2)
    .mockReturnValueOnce(0.8)
    .mockReturnValueOnce(0.6);
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t4');
  expect(game.territories[3].armies).toBe(2);
  expect(game.getPhase()).toBe('attack');
  Math.random.mockRestore();
});

test('gameover phase when one player owns all territories', () => {
  game.territories.forEach(t => { t.owner = 0; });
  game.checkVictory();
  expect(game.getPhase()).toBe('gameover');
  expect(game.winner).toBe(0);
});
