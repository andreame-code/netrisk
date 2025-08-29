import * as ui from '../src/ui.js';
import { GameState } from "../src/state/game.js";
const world8 = require('../src/data/world8.json');

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

  test('world8 map renders eight starting territories', () => {
    destroyUI();
    const territoryDivs = world8.territories
      .map((t) => `<div id="${t.id}"></div>`)
      .join('');
    document.body.innerHTML = `<div id="board"></div>${territoryDivs}`;
    const gameWorld = {
      players: world8.territories.map((_, i) => ({ name: `P${i + 1}`, color: '#000' })),
      currentPlayer: 0,
      territories: world8.territories.map((t, i) => ({ id: t.id, owner: i, armies: 1 })),
      hands: Array(world8.territories.length).fill([]),
      continents: [],
      territoryById: (id) => gameWorld.territories.find((tt) => tt.id === id),
      getPhase: () => 'attack',
      reinforcements: 0,
      canUndo: () => false,
    };
    const positions = Object.fromEntries(
      world8.territories.map((t) => [t.id, { x: t.x, y: t.y }]),
    );
    const gs = new GameState();
    initUI({ game: gameWorld, gameState: gs, territoryPositions: positions });
    updateUI();
    for (const t of world8.territories) {
      expect(document.getElementById(t.id).textContent).toBe('1');
    }
  });

  test('world8 map assigns unique color to each of eight players', () => {
    destroyUI();
    const territoryDivs = world8.territories
      .map((t) => `<div id="${t.id}"></div>`)
      .join('');
    document.body.innerHTML = `<div id="board"></div>${territoryDivs}`;
    const colors = [
      '#e6194b',
      '#3cb44b',
      '#ffe119',
      '#0082c8',
      '#f58231',
      '#911eb4',
      '#46f0f0',
      '#f032e6',
    ];
    const gameWorld = {
      players: colors.map((c, i) => ({ name: `P${i + 1}`, color: c })),
      currentPlayer: 0,
      territories: world8.territories.map((t, i) => ({ id: t.id, owner: i, armies: 1 })),
      hands: Array(world8.territories.length).fill([]),
      continents: [],
      territoryById: (id) => gameWorld.territories.find((tt) => tt.id === id),
      getPhase: () => 'attack',
      reinforcements: 0,
      canUndo: () => false,
    };
    const positions = Object.fromEntries(
      world8.territories.map((t) => [t.id, { x: t.x, y: t.y }]),
    );
    const gs = new GameState();
    initUI({ game: gameWorld, gameState: gs, territoryPositions: positions });
    updateUI();
    colors.forEach((c, i) => {
      const className = `player-color-${c.replace(/[^a-z0-9]/gi, '')}`;
      const terrId = world8.territories[i].id;
      expect(document.getElementById(terrId).classList.contains(className)).toBe(true);
    });
  });
});
