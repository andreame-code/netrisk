jest.mock('../src/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../src/logger.js');
const cleanupServiceWorkers = require('../src/service-worker-cleanup.js').default;

describe('cleanupServiceWorkers', () => {
  afterEach(() => {
    delete navigator.serviceWorker;
    jest.clearAllMocks();
  });

  test('removes existing service worker registrations', async () => {
    const unregister1 = jest.fn();
    const unregister2 = jest.fn();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistrations: jest.fn().mockResolvedValue([
          { unregister: unregister1 },
          { unregister: unregister2 },
        ]),
      },
      configurable: true,
    });

    cleanupServiceWorkers();

    await Promise.resolve();

    expect(navigator.serviceWorker.getRegistrations).toHaveBeenCalled();
    expect(unregister1).toHaveBeenCalled();
    expect(unregister2).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Found 2 service worker(s)');
  });
});
