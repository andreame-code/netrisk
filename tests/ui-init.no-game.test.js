jest.mock("../src/territory-selection.js", () => jest.fn());
jest.mock("../src/logger.js", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock("../src/move-prompt.js", () => jest.fn());
jest.mock("../src/navigation.js", () => ({
  navigateTo: jest.fn(),
  exitGame: jest.fn(),
}));
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
jest.mock("../src/phases.js", () => ({
  REINFORCE: 0,
  ATTACK: 1,
  FORTIFY: 2,
  GAME_OVER: 3,
}));
jest.mock("../src/stats.js", () => ({
  attachStatsListeners: jest.fn(),
  exportStats: jest.fn(),
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
jest.mock("../src/phase-timer.js", () => jest.fn(() => ({ stop: jest.fn() })));
jest.mock("../src/config.js", () => ({ WS_URL: "ws://test" }));
jest.mock("../src/init/game-loader.js", () => ({
  loadGame: jest.fn(() =>
    Promise.resolve({ game: null, territoryPositions: {}, error: new Error("fail") }),
  ),
}));
jest.mock("../src/state/storage.js", () => ({
  updateGameState: jest.fn(),
  clearSavedData: jest.fn(),
  hasSavedPlayers: jest.fn(() => true),
  hasSavedGame: jest.fn(() => true),
  getMapName: jest.fn(() => "map"),
}));
jest.mock("../src/data/level-accessibility.js", () => ({
  applyLevelAccessibility: jest.fn(),
}));
jest.mock("../src/game/state/index.js", () => ({
  gameState: { turnNumber: 1 },
  initGameState: jest.fn(),
}));
jest.mock("../src/ai-logging.js", () => jest.fn());

describe("initGame handles load failure", () => {
  test("shows error message when game fails to load", async () => {
    document.body.innerHTML =
      '<div id="loadError" class="hidden"><p id="loadErrorMsg"></p><button id="retryLoad"></button></div><button id="endTurn"></button>';
    const audio = require("../src/audio.js");
    const uiInit = require("../src/ui-init.js");
    await expect(uiInit.initGame()).resolves.toBeUndefined();
    const errorEl = document.getElementById("loadError");
    expect(errorEl.classList.contains("hidden")).toBe(false);
    expect(audio.preloadEffects).not.toHaveBeenCalled();
  });
});
