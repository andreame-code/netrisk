import { REINFORCE, ATTACK, FORTIFY } from '../src/phases.js';

jest.mock('../src/core/event-bus.js', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  }));
});

import Game from '../src/game.js';

describe('game user flows', () => {
  const baseMap = () => [
    { id: 'a', neighbors: ['b', 'c'], x: 0, y: 0, owner: 0, armies: 3 },
    { id: 'b', neighbors: ['a', 'c'], x: 0, y: 0, owner: 1, armies: 2 },
    { id: 'c', neighbors: ['a', 'b'], x: 0, y: 0, owner: 0, armies: 1 },
  ];

  let game;
  const plugin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    game = new Game([{ name: 'P1' }, { name: 'P2' }], baseMap(), [], [], false, false);
    game.use(plugin);
  });

  test('plugin is applied', () => {
    expect(plugin).toHaveBeenCalledWith(game);
  });

  test('reinforcement adds armies and switches phase', () => {
    game.reinforcements = 1;
    const res = game.handleTerritoryClick('a');
    expect(res).toEqual({ type: REINFORCE, territory: 'a' });
    expect(game.territoryById('a').armies).toBe(4);
    expect(game.reinforcements).toBe(0);
    expect(game.getPhase()).toBe(ATTACK);
  });

  test('attack conquers territory', () => {
    game.setPhase(ATTACK);
    const from = game.territoryById('a');
    from.armies = 5;
    const to = game.territoryById('b');
    to.owner = 1;
    to.armies = 1;
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0.7)
      .mockReturnValueOnce(0.1);
    game.handleTerritoryClick('a');
    const result = game.handleTerritoryClick('b');
    Math.random.mockRestore();
    expect(result.conquered).toBe(true);
    expect(to.owner).toBe(0);
  });

  test('fortify moves armies between owned territories', () => {
    game.setPhase(FORTIFY);
    const from = game.territoryById('a');
    from.armies = 4;
    const to = game.territoryById('c');
    to.owner = 0;
    const select = game.handleTerritoryClick('a');
    expect(select).toEqual({ type: 'select', territory: 'a' });
    const fortify = game.handleTerritoryClick('c');
    expect(fortify).toEqual({
      type: FORTIFY,
      from: 'a',
      to: 'c',
      movableArmies: 3,
    });
    const moved = game.moveArmies('a', 'c', 2);
    expect(moved).toBe(true);
    expect(game.territoryById('a').armies).toBe(2);
    expect(game.territoryById('c').armies).toBe(3);
  });

  test('undo not available outside reinforcement', () => {
    game.setPhase(FORTIFY);
    game.moveArmies('a', 'c', 2);
    expect(game.canUndo()).toBe(false);
    const result = game.undo();
    expect(result).toBe(false);
    expect(game.territoryById('a').armies).toBe(1);
    expect(game.territoryById('c').armies).toBe(3);
  });

  test('serialize and deserialize preserve state', () => {
    game.setPhase(ATTACK);
    const state = game.serialize();
    const clone = Game.deserialize(state);
    expect(clone.getPhase()).toBe(ATTACK);
    expect(clone.territoryById('a').armies).toBe(game.territoryById('a').armies);
    expect(clone.players).toEqual(game.players);
  });
});
