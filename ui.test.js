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
} from './ui.js';

describe('ui utilities', () => {
  let game;
  let gameState;
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="board"></div>
      <div id="victoryModal"><div id="victoryTitle"></div><div id="victoryStats"></div></div>
      <div id="bonusInfo"></div>
      <div id="cards"></div>
      <div id="actionLog"></div>
    `;
    game = {
      players: [
        { name: 'P1', color: '#f00' },
        { name: 'P2', color: '#0f0' }
      ],
      currentPlayer: 0,
      territories: [
        { id: 'from', owner: 0, armies: 1 },
        { id: 'to', owner: 0, armies: 1 }
      ],
      hands: [[
        { territory: 'x', type: 'infantry' },
        { territory: 'y', type: 'cavalry' },
        { territory: 'z', type: 'artillery' }
      ]],
      continents: [
        { name: 'c1', territories: ['from'], bonus: 2 }
      ],
      territoryById: (id) => game.territories.find(t => t.id === id)
    };
    gameState = { currentPlayer: 0, turnNumber: 1, log: [] };
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

  test('getBoardScale uses client size to align armies with map', () => {
    const board = document.getElementById('board');
    Object.defineProperty(board, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(board, 'clientHeight', { value: 400, configurable: true });
    board.getBoundingClientRect = () => ({ width: 620, height: 420 });
    const scale = getBoardScale();
    expect(scale).toEqual({ x: 1, y: 1 });
  });
});
