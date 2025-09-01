const { EventEmitter } = require("events");

describe("AI action logging", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("logs actions for AI players", () => {
    const info = jest.fn();
    jest.isolateModules(() => {
      jest.doMock("../src/ui.js", () => ({
        addLogEntry: jest.fn(),
        updateInfoPanel: jest.fn(),
      }));
      jest.doMock("../src/state/storage.js", () => ({
        updateGameState: jest.fn(),
      }));
      jest.doMock("../src/logger.js", () => ({ info }));

      const attachAIActionLogging = require("../src/ai-logging.js").default;
      const { REINFORCE, ATTACK } = require("../src/phases.js");

      class MockGame extends EventEmitter {
        constructor() {
          super();
          this.players = [{ name: "CPU", ai: true }];
          this.currentPlayer = 0;
        }
      }

      const game = new MockGame();
      attachAIActionLogging(game);
      game.emit(REINFORCE, { territory: "a", player: 0 });
      game.emit(ATTACK, { from: "a", to: "b" });
    });
    expect(info).toHaveBeenCalledWith("CPU reinforces a");
    expect(info).toHaveBeenCalledWith("CPU attacks b from a");
  });

  test("gracefully handles missing logger", () => {
    jest.isolateModules(() => {
      jest.doMock("../src/ui.js", () => ({
        addLogEntry: jest.fn(),
        updateInfoPanel: jest.fn(),
      }));
      jest.doMock("../src/state/storage.js", () => ({
        updateGameState: jest.fn(),
      }));
      jest.doMock("../src/logger.js", () => ({}));

      const attachAIActionLogging = require("../src/ai-logging.js").default;
      const { REINFORCE } = require("../src/phases.js");
      class MockGame extends EventEmitter {
        constructor() {
          super();
          this.players = [{ name: "CPU", ai: true }];
          this.currentPlayer = 0;
        }
      }

      const game = new MockGame();
      attachAIActionLogging(game);
      expect(() =>
        game.emit(REINFORCE, { territory: "a", player: 0 }),
      ).not.toThrow();
    });
  });
});
