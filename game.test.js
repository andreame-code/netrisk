import Game from "./game.js";
import { REINFORCE, ATTACK, FORTIFY, GAME_OVER } from "./phases.js";
import aiTurnManager from "./src/ai/turn-manager.js";

let game;

const mapMock = {
  territories: [
    { id: 't1', neighbors: ['t2', 't4'], x: 120, y: 100 },
    { id: 't2', neighbors: ['t1', 't3', 't5'], x: 340, y: 110 },
    { id: 't3', neighbors: ['t2', 't6'], x: 500, y: 140 },
    { id: 't4', neighbors: ['t1', 't5'], x: 150, y: 260 },
    { id: 't5', neighbors: ['t2', 't4', 't6'], x: 360, y: 220 },
    { id: 't6', neighbors: ['t3', 't5'], x: 520, y: 300 },
  ],
  continents: [
    { name: 'north', territories: ['t1', 't2', 't3'], bonus: 2 },
    { name: 'south', territories: ['t4', 't5', 't6'], bonus: 2 },
  ],
  deck: [
    { territory: 't1', type: 'infantry' },
    { territory: 't2', type: 'cavalry' },
    { territory: 't3', type: 'artillery' },
    { territory: 't4', type: 'infantry' },
    { territory: 't5', type: 'cavalry' },
    { territory: 't6', type: 'artillery' },
  ],
};

beforeEach(() => {
  game = new Game(null, mapMock.territories, mapMock.continents, mapMock.deck, false);
  game.use(aiTurnManager);
});

test('reinforce phase allows adding army and moves to attack', () => {
  const initial = game.territories[0].armies;
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  expect(game.territories[0].armies).toBe(initial + 3);
  expect(game.getPhase()).toBe(ATTACK);
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
  expect(game.getPhase()).toBe(ATTACK);
  Math.random.mockRestore();
});

test('attack returns movable armies after conquest and moveArmies transfers them', () => {
  game.setPhase(ATTACK);
  const from = game.territoryById('t2');
  const to = game.territoryById('t3');
  from.armies = 5;
  to.owner = 1; to.armies = 1;
  jest.spyOn(Math, 'random')
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.8)
    .mockReturnValueOnce(0.7)
    .mockReturnValueOnce(0.1);
  const res = game.attack(from, to);
  Math.random.mockRestore();
  expect(res.conquered).toBe(true);
  expect(res.movableArmies).toBe(3);
  const moved = game.moveArmies('t2', 't3', 2);
  expect(moved).toBe(true);
  expect(from.armies).toBe(2);
  expect(to.armies).toBe(3);
});

test('gameover phase when one player owns all territories', () => {
  game.territories.forEach(t => { t.owner = 0; });
  game.checkVictory();
  expect(game.getPhase()).toBe(GAME_OVER);
  expect(game.winner).toBe(0);
});

test('checkVictory returns null when there are no territories', () => {
  const g = new Game(null, [], [], [], false);
  expect(() => g.checkVictory()).not.toThrow();
  expect(g.checkVictory()).toBeNull();
});

test('calculateReinforcements enforces minimum of three armies', () => {
  const territories = [
    { id: 'a', neighbors: [], owner: 0, armies: 1 },
    { id: 'b', neighbors: [], owner: 0, armies: 1 },
    { id: 'c', neighbors: [], owner: 0, armies: 1 }
  ];
  const g = new Game(null, territories, [], [], false);
  expect(g.reinforcements).toBe(3);
});

test('endTurn moves from attack to fortify then to next player', () => {
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  expect(game.getPhase()).toBe(ATTACK);
  game.endTurn();
  expect(game.getPhase()).toBe(FORTIFY);
  game.endTurn();
  expect(game.getPhase()).toBe(REINFORCE);
  expect(game.getCurrentPlayer()).toBe(1);
});

test('AI reinforces highest priority territory', () => {
  game.setCurrentPlayer(2);
  game.reinforcements = 1;
  const t5 = game.territoryById('t5'); t5.owner = 2; t5.armies = 1;
  const t6 = game.territoryById('t6'); t6.owner = 2; t6.armies = 1;
  const t2 = game.territoryById('t2'); t2.owner = 0; t2.armies = 5;
  const t4 = game.territoryById('t4'); t4.owner = 1; t4.armies = 5;
  game.performAITurn();
  expect(t5.armies).toBe(2);
});

test('AI plays cards before reinforcing', () => {
  game.setCurrentPlayer(2);
  game.reinforcements = 1;
  game.hands[2] = [
    { territory: 'a', type: 'infantry' },
    { territory: 'b', type: 'cavalry' },
    { territory: 'c', type: 'artillery' }
  ];
  const spy = jest.spyOn(game, 'playCards');
  game.territoryById('t5').owner = 2; game.territoryById('t5').armies = 1;
  game.territoryById('t6').owner = 2; game.territoryById('t6').armies = 1;
  game.performAITurn();
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

test('AI chooses attacks with highest probability', () => {
  game.setCurrentPlayer(2);
  game.setPhase(ATTACK);
  game.reinforcements = 0;
  const t5 = game.territoryById('t5'); t5.owner = 2; t5.armies = 5;
  const t2 = game.territoryById('t2'); t2.owner = 0; t2.armies = 1;
  const t4 = game.territoryById('t4'); t4.owner = 1; t4.armies = 3;
  const attack = jest.spyOn(game, 'attack').mockImplementation((from, to) => {
    to.owner = from.owner; to.armies = 1; from.armies -= 1; return { conquered: true };
  });
  game.performAITurn();
  expect(attack).toHaveBeenCalledTimes(1);
  expect(attack.mock.calls[0][1].id).toBe('t2');
  attack.mockRestore();
});

test('AI fortifies toward strategic territory', () => {
  game.setCurrentPlayer(2);
  game.setPhase(ATTACK);
  game.reinforcements = 0;
  const t5 = game.territoryById('t5'); t5.owner = 2; t5.armies = 3;
  const t6 = game.territoryById('t6'); t6.owner = 2; t6.armies = 3;
  const t2 = game.territoryById('t2'); t2.owner = 0; t2.armies = 5;
  const t4 = game.territoryById('t4'); t4.owner = 1; t4.armies = 5;
  game.performAITurn();
  expect(t5.armies).toBe(4);
  expect(t6.armies).toBe(2);
});

test('continent bonus is added to reinforcements', () => {
  ['t1', 't2', 't3'].forEach(id => { game.territoryById(id).owner = 0; });
  game.calculateReinforcements();
  expect(game.reinforcements).toBe(5); // 3 base +2 continent
});

test('player draws a card after conquering a territory', () => {
  const awarded = jest.fn();
  game.on('cardAwarded', awarded);
  game.setPhase(ATTACK);
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
  expect(awarded).toHaveBeenCalled();
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

test('initialises with 1 human and 2 AI players and executes AI turn', () => {
  const players = [
    { name: 'Human', color: '#000000' },
    { name: 'AI 1', color: '#2ecc71', ai: true },
    { name: 'AI 2', color: '#2ecc71', ai: true }
  ];
  const g = new Game(players, mapMock.territories, mapMock.continents, mapMock.deck, false);
  g.use(aiTurnManager);
  expect(g.players.filter(p => p.ai).length).toBe(2);
  g.setCurrentPlayer(1);
  g.performAITurn();
  expect(g.getCurrentPlayer()).toBe(2);
});

test('initialises with three human players and no AI', () => {
  const players = [
    { name: 'P1', color: '#000000' },
    { name: 'P2', color: '#111111' },
    { name: 'P3', color: '#222222' }
  ];
  const g = new Game(players, mapMock.territories, mapMock.continents, mapMock.deck, false);
  g.use(aiTurnManager);
  expect(g.players.every(p => !p.ai)).toBe(true);
  const current = g.getCurrentPlayer();
  g.performAITurn();
  expect(g.getCurrentPlayer()).toBe(current);
});

test('players with no territories are skipped on turn rotation', () => {
  // Setup: player 1 has a single territory that will be conquered
  const t2 = game.territoryById('t2');
  const t3 = game.territoryById('t3');
  const t4 = game.territoryById('t4');
  t2.armies = 5; // attacker
  t3.owner = 1; t3.armies = 1; // defender's last territory
  t4.owner = 2; // ensure player 1 has no other territories
  game.setPhase(ATTACK);
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
  expect(game.getPhase()).toBe(REINFORCE);
});

test('serialize and deserialize restores game state', () => {
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  game.handleTerritoryClick('t1');
  const saved = game.serialize();
  const restored = Game.deserialize(saved);
  expect(restored.territoryById('t1').armies).toBe(
    game.territoryById('t1').armies
  );
  expect(restored.getPhase()).toBe(game.getPhase());
  expect(restored.getCurrentPlayer()).toBe(game.getCurrentPlayer());
});

test('drawCard reshuffles discard pile when deck is empty', () => {
  const deck = [{ territory: 't1', type: 'infantry' }];
  const g = new Game(null, mapMock.territories, mapMock.continents, deck, false);
  g.discard = [{ territory: 't2', type: 'cavalry' }];
  const first = g.drawCard(0);
  expect(first.territory).toBe('t1');
  const second = g.drawCard(0);
  expect(second.territory).toBe('t2');
  expect(g.deck.length).toBe(0);
});

test('players must trade a set when holding more than five cards', () => {
  const players = [
    { name: 'P1', color: '#000000' },
    { name: 'P2', color: '#111111' },
  ];
  const deck = [];
  const g = new Game(players, mapMock.territories, mapMock.continents, deck, false);
  g.hands[1] = [
    { territory: 'a', type: 'infantry' },
    { territory: 'b', type: 'infantry' },
    { territory: 'c', type: 'infantry' },
    { territory: 'd', type: 'cavalry' },
    { territory: 'e', type: 'cavalry' },
    { territory: 'f', type: 'cavalry' },
  ];
  g.setPhase(FORTIFY);
  g.endTurn();
  expect(g.getCurrentPlayer()).toBe(1);
  expect(g.hands[1].length).toBe(3);
  expect(g.reinforcements).toBe(10);
});
