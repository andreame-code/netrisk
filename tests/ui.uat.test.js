import * as ui from '../src/ui.js';
import { GameState } from "../src/state/game.js";

const { initUI, addLogEntry, updateUI, animateMove, destroyUI } = ui;

describe('ui integration', () => {
  let game;
  let gameState;

  beforeEach(() => {
    game = {
      players: [{ name: 'P1', color: '#f00' }],
      currentPlayer: 0,
      territories: [{ id: 't1', owner: 0, armies: 5 }],
      hands: [[]],
      continents: [],
      territoryById: (id) => game.territories.find((t) => t.id === id),
      getPhase: () => 'attack',
      reinforcements: 0,
      canUndo: () => false,
    };
    gameState = new GameState();
  });

  afterEach(() => {
    destroyUI();
  });

  test('initUI registers resize handler and renders territory', () => {
    document.body.innerHTML = '<div id="board"></div><div id="t1"></div>';
    const addSpy = jest.spyOn(window, 'addEventListener');
    initUI({ game, gameState, territoryPositions: { t1: { x: 0, y: 0 } } });
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    updateUI();
    expect(document.getElementById('t1').textContent).toBe('5');
    addSpy.mockRestore();
  });

  test('addLogEntry records entry even without DOM', () => {
    document.body.innerHTML = '';
    initUI({ game, gameState, territoryPositions: {} });
    const entry = addLogEntry('hello world');
    expect(gameState.log).toHaveLength(1);
    expect(entry.message).toBe('hello world');
  });

  test('updateUI handles missing elements gracefully', () => {
    document.body.innerHTML = '<div id="t1"></div>';
    initUI({ game, gameState, territoryPositions: { t1: { x: 0, y: 0 } } });
    expect(() => updateUI()).not.toThrow();
    expect(document.getElementById('t1').textContent).toBe('5');
  });

  test('animateMove supports multiple simultaneous tokens', () => {
    document.body.innerHTML = '<div id="board"></div>';
    const positions = { a: { x: 0, y: 0 }, b: { x: 10, y: 10 }, c: { x: 20, y: 20 } };
    initUI({ game, gameState, territoryPositions: positions });
    const raf = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb) => cb();
    animateMove('a', 'b');
    animateMove('b', 'c');
    const tokens = document.querySelectorAll('.move-token');
    expect(tokens.length).toBe(2);
    tokens.forEach((t) => {
      t.dispatchEvent(new Event('transitionend'));
      t.dispatchEvent(new Event('animationend'));
    });
    expect(document.querySelectorAll('.move-token').length).toBe(0);
    global.requestAnimationFrame = raf;
  });

  test('destroyUI removes resize listener', () => {
    document.body.innerHTML = '<div id="board"></div>';
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    initUI({ game, gameState, territoryPositions: {} });
    const handler = addSpy.mock.calls.find((c) => c[0] === 'resize')[1];
    destroyUI();
    expect(removeSpy).toHaveBeenCalledWith('resize', handler);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
