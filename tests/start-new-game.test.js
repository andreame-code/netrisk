jest.mock("../src/navigation.js", () => ({
  navigateTo: jest.fn(),
  exitGame: jest.fn(),
}));

jest.mock("../src/state/storage.js", () => ({
  clearSavedData: jest.fn(),
  hasSavedPlayers: jest.fn(() => true),
  hasSavedGame: jest.fn(() => true),
  updateGameState: jest.fn(),
  getMapName: jest.fn(() => 'map'),
}));

jest.mock("../src/ui.js", () => ({
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

jest.mock("../src/init/game-loader.js", () => ({
  loadGame: jest.fn(() =>
    Promise.resolve({
      game: {
        on: jest.fn(),
        use: jest.fn(),
        players: [{ ai: false, name: "p1" }],
        currentPlayer: 0,
        getPhase: jest.fn(() => 0),
        performAITurn: jest.fn(),
        checkVictory: jest.fn(() => null),
      },
      territoryPositions: {},
    }),
  ),
}));

jest.mock("../src/phase-timer.js", () => jest.fn(() => ({ stop: jest.fn() })));

jest.mock("../src/stats.js", () => ({
  attachStatsListeners: jest.fn(),
  exportStats: jest.fn(),
}));

jest.mock("../src/tutorial.js", () => ({ initTutorialButtons: jest.fn() }));

jest.mock("../src/theme.js", () => ({ initThemeToggle: jest.fn() }));

jest.mock("../src/move-prompt.js", () => jest.fn());

jest.mock("../src/territory-selection.js", () => jest.fn());

jest.mock("../src/audio.js", () => ({
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

jest.mock("../src/state/game.js", () => ({
  gameState: {},
  initGameState: jest.fn(),
}));

jest.mock("../src/logger.js", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

document.body.innerHTML = '<div id="uiPanel"></div><button id="exitGame"></button><button id="endTurn"></button>';

  const { startNewGame } = require("../src/main.js");
const { navigateTo } = require("../src/navigation.js");

describe("startNewGame navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url);
  });

  test("navigates to setup in single-player", () => {
    startNewGame();
    expect(navigateTo).toHaveBeenCalledWith("setup.html");
  });

  test("navigates to lobby in multiplayer", () => {
    const url = new URL(window.location.href);
    url.search = "?multiplayer=1";
    window.history.replaceState({}, "", url);
    startNewGame();
    expect(navigateTo).toHaveBeenCalledWith("lobby.html");
  });
});
