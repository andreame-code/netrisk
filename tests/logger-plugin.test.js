const loggerPlugin = require('../src/plugins/logger-plugin.js').default;
const { REINFORCE } = require('../src/phases.js');

describe('logger plugin', () => {
  let handlers;
  let game;
  let logger;

  beforeEach(() => {
    handlers = {};
    game = {
      on: jest.fn((event, listener) => {
        handlers[event] = listener;
      }),
    };
    logger = { log: jest.fn() };
    loggerPlugin(game, logger);
  });

  test('logs reinforcement events', () => {
    handlers[REINFORCE]({ territory: 'Alaska', player: 'P1' });
    expect(logger.log).toHaveBeenCalledWith('Player P1 reinforces Alaska');
  });

  test('logs attack results', () => {
    const result = { success: true };
    handlers.attackResolved({ from: 'A', to: 'B', result });
    expect(logger.log).toHaveBeenCalledWith('Attack from A to B', result);
  });

  test('logs phase changes', () => {
    handlers.phaseChange({ phase: 'attack', player: 'P2' });
    expect(logger.log).toHaveBeenCalledWith('Player P2 enters phase attack');
  });
});
