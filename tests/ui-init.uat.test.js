jest.mock('../src/territory-selection.js', () => jest.fn());
jest.mock('../src/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../src/move-prompt.js', () => jest.fn());
jest.mock('../src/navigation.js', () => ({
  navigateTo: jest.fn(),
  exitGame: jest.fn(),
}));
jest.mock('../src/audio.js', () => ({
  playEffect: jest.fn(),
  preloadEffects: jest.fn(),
  setMasterVolume: jest.fn(),
  getMasterVolume: jest.fn(() => 1),
  setEffectsVolume: jest.fn(),
  getEffectsVolume: jest.fn(() => 1),
  setMuted: jest.fn(),
  isMuted: jest.fn(() => false),
  setMusicEnabled: jest.fn(),
  isMusicEnabled: jest.fn(() => false),
  setLevelMusic: jest.fn(),
}));
jest.mock('../src/phases.js', () => ({
  REINFORCE: 0,
  ATTACK: 1,
  FORTIFY: 2,
  GAME_OVER: 3,
}));
jest.mock('../src/stats.js', () => ({
  attachStatsListeners: jest.fn(),
  exportStats: jest.fn(),
}));
jest.mock('../src/ui.js', () => ({
  initUI: jest.fn(),
  updateInfoPanel: jest.fn(),
  addLogEntry: jest.fn(),
  animateMove: jest.fn(),
  animateAttack: jest.fn(),
  animateReinforce: jest.fn(),
  showVictoryModal: jest.fn(),
  updateUI: jest.fn(),
  destroyUI: jest.fn(),
  resetSelectedCards: jest.fn(),
  getSelectedCards: jest.fn(() => []),
  exportLog: jest.fn(),
}));
jest.mock('../src/phase-timer.js', () => jest.fn(() => ({ stop: jest.fn() })));
jest.mock('../src/config.js', () => ({ WS_URL: 'ws://test' }));
let mockGame;
jest.mock('../src/init/game-loader.js', () => ({
  loadGame: jest.fn(() => Promise.resolve({ game: mockGame, territoryPositions: {} })),
}));
jest.mock('../src/state/storage.js', () => ({
  updateGameState: jest.fn(),
  clearSavedData: jest.fn(),
  hasSavedPlayers: jest.fn(() => true),
  hasSavedGame: jest.fn(() => true),
  getMapName: jest.fn(() => 'map'),
}));
jest.mock('../src/data/level-accessibility.js', () => ({
  applyLevelAccessibility: jest.fn(),
}));
jest.mock('../src/game/state/index.js', () => ({
  gameState: { turnNumber: 1 },
  initGameState: jest.fn(),
}));
jest.mock('../src/ai-logging.js', () => jest.fn());

describe('ui-init game start and navigation', () => {
  let uiInit;
  let ui;
  let navigation;

  beforeEach(async () => {
    jest.resetModules();
    mockGame = {
      on: jest.fn(),
      use: jest.fn(),
      players: [{ name: 'P1', ai: false }],
      currentPlayer: 0,
      getPhase: jest.fn(() => 0),
      performAITurn: jest.fn(),
      checkVictory: jest.fn(() => 0),
      handleTerritoryClick: jest.fn(() => null),
      moveArmies: jest.fn(),
      endTurn: jest.fn(),
    };
    document.body.innerHTML = `
      <div id="loadError" class="hidden"><p id="loadErrorMsg"></p><button id="retryLoad"></button></div>
      <div id="uiPanel"></div>
      <div id="actionLog"></div>
      <div id="diceResults"></div>
      <button id="exitGame"></button>
      <button id="endTurn"></button>
      <button class="territory" id="t1" data-id="t1"></button>
    `;
    uiInit = require('../src/ui-init.js');
    ui = require('../src/ui.js');
    navigation = require('../src/navigation.js');
    await uiInit.initGame();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('clicking territory triggers victory check', () => {
    uiInit.attachTerritoryHandlers();
    const territory = document.getElementById('t1');
    territory.click();
    expect(mockGame.handleTerritoryClick).toHaveBeenCalledWith('t1');
    expect(ui.showVictoryModal).toHaveBeenCalledWith(0);
  });

  test('navigation handlers invoke exit and new game', () => {
    uiInit.attachNavigationHandlers();
    document.getElementById('exitGame').click();
    expect(navigation.exitGame).toHaveBeenCalled();

    navigation.navigateTo.mockClear();
    const resetBtn = document.getElementById('resetGame');
    expect(resetBtn).not.toBeNull();
    resetBtn.click();
    expect(navigation.navigateTo).toHaveBeenCalledWith('setup.html');
  });

  test('initGame does not show error on success', () => {
    expect(document.getElementById('loadError').classList.contains('hidden')).toBe(true);
  });
});
