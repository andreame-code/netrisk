import {
  initUI,
  addLogEntry,
  getSelectedCards,
  resetSelectedCards,
  animateMove,
  showVictoryModal,
  updateBonusInfo,
  updateCardsUI,
  getBoardScale,
  destroyUI,
  updateInfoPanel,
  getLog,
  exportLog,
  copyLog,
} from '../src/ui.js';
import { GameState } from '../src/game/state/index.js';

describe('ui utilities', () => {
  let game;
  let gameState;
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="board"></div>
      <div id="currentPlayer"></div>
      <div id="turnNumber"></div>
      <div id="victoryModal"><div id="victoryTitle"></div><div id="victoryStats"></div></div>
      <div id="bonusInfo"></div>
      <div id="cards"></div>
      <div id="actionLog"></div>
      <button id="t1" class="territory"></button>
      <button id="t2" class="territory"></button>
    `;
    game = {
      players: [
        { name: 'P1', color: '#f00' },
        { name: 'P2', color: '#0f0' },
      ],
      currentPlayer: 0,
      territories: [
        { id: 'from', owner: 0, armies: 1 },
        { id: 'to', owner: 0, armies: 1 },
      ],
      hands: [
        [
          { territory: 'x', type: 'infantry' },
          { territory: 'y', type: 'cavalry' },
          { territory: 'z', type: 'artillery' },
        ],
      ],
      continents: [{ name: 'c1', territories: ['from'], bonus: 2 }],
      territoryById: (id) => game.territories.find((t) => t.id === id),
    };
    gameState = new GameState();
    const territoryPositions = { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } };
    initUI({ game, gameState, territoryPositions });
  });

  test('getSelectedCards and resetSelectedCards', () => {
    resetSelectedCards();
    expect(getSelectedCards()).toEqual([]);
  });

  test('animateMove creates a token element', () => {
    global.requestAnimationFrame = (cb) => cb();
    animateMove('from', 'to');
    const token = document.querySelector('.move-token');
    expect(token).not.toBeNull();
  });

  test('showVictoryModal displays winner info', () => {
    showVictoryModal(0);
    const modal = document.getElementById('victoryModal');
    expect(modal.classList.contains('show')).toBe(true);
    expect(document.getElementById('victoryTitle').textContent).toContain('P1 has won');
  });

  test('updateBonusInfo shows continent bonus', () => {
    updateBonusInfo();
    expect(document.getElementById('bonusInfo').textContent).toBe('Bonus: c1 +2');
  });

  test('updateCardsUI renders hand and tracks selection', () => {
    updateCardsUI();
    const cards = document.querySelectorAll('#cards .card');
    expect(cards.length).toBe(3);
    cards[0].dispatchEvent(new window.Event('click'));
    expect(getSelectedCards()).toEqual([0]);
    resetSelectedCards();
    expect(getSelectedCards()).toEqual([]);
  });

  test('addLogEntry retains full history and displays last 10', () => {
    for (let i = 1; i <= 12; i++) {
      addLogEntry(`msg${i}`);
    }
    expect(gameState.log.length).toBe(12);
    const logEl = document.getElementById('actionLog');
    expect(logEl.children.length).toBe(10);
    expect(logEl.firstChild.textContent).toBe('msg3');
    expect(logEl.lastChild.textContent).toBe('msg12');
  });

  test('getLog filters by player and type', () => {
    addLogEntry('P1 attacks', { player: 'P1', type: 'attack' });
    addLogEntry('P2 reinforces', { player: 'P2', type: 'reinforce' });
    expect(getLog({ player: 'P1' })).toHaveLength(1);
    expect(getLog({ type: 'reinforce' })).toHaveLength(1);
  });

  test('exportLog outputs JSON and CSV', () => {
    addLogEntry('P1 attacks', {
      player: 'P1',
      type: 'attack',
      territories: ['t1', 't2'],
    });
    const json = exportLog('json');
    expect(json).toContain('"P1"');
    const csv = exportLog('csv');
    expect(csv.split('\n')[1]).toContain('P1');
  });

  test('copyLog writes to clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });
    await copyLog('json');
    expect(writeText).toHaveBeenCalled();
  });

  test('go to move link highlights territories', () => {
    jest.useFakeTimers();
    addLogEntry('P1 attacks t2 from t1', {
      player: 'P1',
      type: 'attack',
      territories: ['t1', 't2'],
    });
    const logEl = document.getElementById('actionLog');
    const link = logEl.querySelector('a');
    link.dispatchEvent(new window.Event('click'));
    expect(document.getElementById('t1').classList.contains('highlight')).toBe(true);
    jest.runAllTimers();
    expect(document.getElementById('t1').classList.contains('highlight')).toBe(false);
    jest.useRealTimers();
  });

  test('getBoardScale uses client size to align armies with map', () => {
    const board = document.getElementById('board');
    Object.defineProperty(board, 'clientWidth', {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(board, 'clientHeight', {
      value: 400,
      configurable: true,
    });
    board.getBoundingClientRect = () => ({ width: 620, height: 420 });
    const scale = getBoardScale();
    expect(scale).toEqual({ x: 1, y: 1 });
  });

  test('destroyUI removes resize listener and clears cache', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const getSpy = jest.spyOn(document, 'getElementById');

    updateBonusInfo();
    expect(getSpy).toHaveBeenCalledTimes(1);

    destroyUI();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    updateBonusInfo();
    expect(getSpy).toHaveBeenCalledTimes(2);

    removeSpy.mockRestore();
    getSpy.mockRestore();
  });

  test('updateInfoPanel displays AI profile', () => {
    game.players[0].ai = true;
    game.players[0].difficulty = 'easy';
    game.players[0].style = 'aggressive';
    updateInfoPanel();
    expect(document.getElementById('currentPlayer').textContent).toBe('P1 (Easy/Aggressive)');
  });
});
