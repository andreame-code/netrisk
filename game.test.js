/**
 * @jest-environment jsdom
 */
let game;

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="status"></div>
    <div id="diceResults"></div>
    <div id="board" class="board">
      <div class="territory" id="t1" data-id="t1"></div>
      <div class="territory" id="t2" data-id="t2"></div>
      <div class="territory" id="t3" data-id="t3"></div>
      <div class="territory" id="t4" data-id="t4"></div>
      <div class="territory" id="t5" data-id="t5"></div>
      <div class="territory" id="t6" data-id="t6"></div>
    </div>
    <button id="endTurn">End Turn</button>
  `;
  game = require('./script.js');
});

test('reinforce phase allows adding army and moves to attack', () => {
  const t1 = document.getElementById('t1');
  const initial = game.territories[0].armies;
  game.handleTerritoryClick({ currentTarget: t1 });
  game.handleTerritoryClick({ currentTarget: t1 });
  game.handleTerritoryClick({ currentTarget: t1 });
  expect(game.territories[0].armies).toBe(initial + 3);
  expect(game.getPhase()).toBe('attack');
});

test('attack phase resolves battle between territories', () => {
  const t1 = document.getElementById('t1');
  const t4 = document.getElementById('t4');
  game.handleTerritoryClick({ currentTarget: t1 });
  game.handleTerritoryClick({ currentTarget: t1 });
  game.handleTerritoryClick({ currentTarget: t1 });
  jest.spyOn(Math, 'random')
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.5)
    .mockReturnValueOnce(0.2)
    .mockReturnValueOnce(0.8)
    .mockReturnValueOnce(0.6);
  game.handleTerritoryClick({ currentTarget: t1 });
  game.handleTerritoryClick({ currentTarget: t4 });
  expect(game.territories[3].armies).toBe(2);
  expect(game.getPhase()).toBe('attack');
  Math.random.mockRestore();
});

test('gameover phase when one player owns all territories', () => {
  game.territories.forEach(t => { t.owner = 0; });
  game.checkVictory();
  expect(game.getPhase()).toBe('gameover');
  expect(document.getElementById('status').textContent).toContain('Player 1 wins');
});
