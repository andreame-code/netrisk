// Mock AI utility functions
let attackProb = 0.6;
const priorityMap = { A: 2, B: 1 };

jest.mock('../src/game/ai/index.js', () => ({
  attackSuccessProbability: jest.fn(() => attackProb),
  territoryPriority: jest.fn((game, t) => priorityMap[t.id] || 0),
}));

const turnManager = require('../src/game/ai/turn-manager.js');
const { REINFORCE, ATTACK, FORTIFY } = require('../src/phases.js');

function createGame(style) {
  const territories = [
    { id: 'A', owner: 0, neighbors: ['B'], armies: 1 },
    { id: 'B', owner: 1, neighbors: ['A'], armies: 1 },
  ];
  const game = {
    players: [{ ai: true, difficulty: 'normal', style }],
    currentPlayer: 0,
    hands: [[]],
    findValidSet: jest.fn(() => null),
    playCards: jest.fn(),
    reinforcements: 1,
    territories,
    territoryById(id) {
      return territories.find((t) => t.id === id);
    },
    phase: REINFORCE,
    emit: jest.fn(),
    attack: jest.fn(function () {
      this.phase = FORTIFY;
      return { success: true };
    }),
    moveArmies: jest.fn(),
    endTurn: jest.fn(function () {
      this.phase = 'END';
    }),
  };
  turnManager.default(game); // attach performAITurn
  return game;
}

test('default export adds performAITurn to game', () => {
  const game = {};
  turnManager.default(game);
  expect(typeof game.performAITurn).toBe('function');
});

test('aggressive profile attacks when probability meets lowered threshold', () => {
  const game = createGame('aggressive');
  game.performAITurn();

  expect(game.emit).toHaveBeenCalledWith(REINFORCE, {
    territory: 'A',
    player: 0,
  });
  expect(game.emit).toHaveBeenCalledWith('phaseChange', {
    phase: ATTACK,
    player: 0,
  });
  expect(game.emit).toHaveBeenCalledWith(ATTACK, {
    from: 'A',
    to: 'B',
    result: { success: true },
  });
  expect(game.attack).toHaveBeenCalled();
});

test('defensive profile avoids attacks below higher threshold', () => {
  const game = createGame('defensive');
  game.performAITurn();

  expect(game.emit).toHaveBeenCalledWith(REINFORCE, {
    territory: 'A',
    player: 0,
  });
  expect(game.emit).toHaveBeenCalledWith('phaseChange', {
    phase: ATTACK,
    player: 0,
  });
  expect(game.attack).not.toHaveBeenCalled();
  expect(game.emit).not.toHaveBeenCalledWith(ATTACK, expect.anything());
});
