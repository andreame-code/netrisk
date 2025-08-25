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

test('calculateReinforcements enforces minimum of three armies', () => {
  const territories = [
    { id: 'a', neighbors: [], owner: 0, armies: 1 },
    { id: 'b', neighbors: [], owner: 0, armies: 1 },
    { id: 'c', neighbors: [], owner: 0, armies: 1 }
  ];
  const g = new Game(null, territories);
  expect(g.reinforcements).toBe(3);
});

test('endTurn moves from attack to fortify then to next player', () => {
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  expect(game.getPhase()).toBe('attack');
  game.endTurn();
  expect(game.getPhase()).toBe('fortify');
  game.endTurn();
  expect(game.getPhase()).toBe('reinforce');
  expect(game.getCurrentPlayer()).toBe(1);
});

test('AI player performs its turn and passes play', () => {
  game.setCurrentPlayer(2);
  game.calculateReinforcements();
  jest.spyOn(Math, 'random').mockReturnValue(0.1);
  game.performAITurn();
  Math.random.mockRestore();
  expect(game.getCurrentPlayer()).toBe(0);
  expect(game.getPhase()).toBe('reinforce');
});

test('AI performs multiple advantageous attacks', () => {
  game.setCurrentPlayer(2);
  game.setPhase('attack');
  game.reinforcements = 0;
  const t5 = game.territoryById('t5');
  const t6 = game.territoryById('t6');
  const t2 = game.territoryById('t2');
  const t3 = game.territoryById('t3');
  const t4 = game.territoryById('t4');
  t5.armies = 5;
  t6.armies = 4;
  t2.armies = 1;
  t3.armies = 1;
  t4.armies = 1;
  const attack = jest.spyOn(game, 'attack').mockImplementation((from, to) => {
    to.owner = from.owner;
    to.armies = 1;
    from.armies -= 1;
    return { conquered: true, attackRolls: [], defendRolls: [] };
  });
  jest.spyOn(Math, 'random').mockReturnValue(0);
  game.performAITurn();
  expect(attack).toHaveBeenCalledTimes(3);
  expect(t2.owner).toBe(2);
  expect(t3.owner).toBe(2);
  expect(t4.owner).toBe(2);
  Math.random.mockRestore();
  attack.mockRestore();
});

test('AI fortifies at end of turn', () => {
  game.setCurrentPlayer(2);
  game.setPhase('attack');
  game.reinforcements = 0;
  const t5 = game.territoryById('t5');
  const t6 = game.territoryById('t6');
  const t2 = game.territoryById('t2');
  const t3 = game.territoryById('t3');
  const t4 = game.territoryById('t4');
  t5.armies = 3;
  t6.armies = 1;
  t2.armies = 3; t2.owner = 0;
  t3.armies = 3; t3.owner = 1;
  t4.armies = 3; t4.owner = 1;
  const attack = jest.spyOn(game, 'attack');
  jest.spyOn(Math, 'random').mockReturnValue(0);
  game.performAITurn();
  Math.random.mockRestore();
  expect(attack).not.toHaveBeenCalled();
  expect(t5.armies).toBe(2);
  expect(t6.armies).toBe(2);
  expect(game.getCurrentPlayer()).toBe(0);
  expect(game.getPhase()).toBe('reinforce');
  attack.mockRestore();
});

test('continent bonus is added to reinforcements', () => {
  ['t1', 't2', 't3'].forEach(id => { game.territoryById(id).owner = 0; });
  game.calculateReinforcements();
  expect(game.reinforcements).toBe(5); // 3 base +2 continent
});

test('player draws a card after conquering a territory', () => {
  game.setPhase('attack');
  const from = game.territoryById('t2');
  const to = game.territoryById('t3');
  from.armies = 5;
  to.armies = 1; to.owner = 1;
  jest.spyOn(Math, 'random')
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.8)
    .mockReturnValueOnce(0.7)
    .mockReturnValueOnce(0.1);
  game.handleTerritoryClick('t2');
  game.handleTerritoryClick('t3');
  Math.random.mockRestore();
  game.endTurn();
  game.endTurn();
  expect(game.hands[0].length).toBe(1);
});

test('playing valid card set grants reinforcements', () => {
  game.hands[0] = [
    { territory: 'a', type: 'infantry' },
    { territory: 'b', type: 'cavalry' },
    { territory: 'c', type: 'artillery' }
  ];
  game.reinforcements = 0;
  const played = game.playCards([0, 1, 2]);
  expect(played).toBe(true);
  expect(game.reinforcements).toBe(5);
  expect(game.hands[0].length).toBe(0);
});

test('players with no territories are skipped on turn rotation', () => {
  // Setup: player 1 has a single territory that will be conquered
  const t2 = game.territoryById('t2');
  const t3 = game.territoryById('t3');
  const t4 = game.territoryById('t4');
  t2.armies = 5; // attacker
  t3.owner = 1; t3.armies = 1; // defender's last territory
  t4.owner = 2; // ensure player 1 has no other territories
  game.setPhase('attack');
  // Ensure deterministic conquest
  jest.spyOn(Math, 'random').mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.1);
  game.attack(t2, t3);
  Math.random.mockRestore();
  // End current player's turn completely
  game.endTurn(); // to fortify
  game.endTurn(); // to next player
  // Player 1 had no territories, so it should now be player 2's turn
  expect(game.getCurrentPlayer()).toBe(2);
  expect(game.getPhase()).toBe('reinforce');
});
