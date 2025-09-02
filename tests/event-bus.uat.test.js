import EventBus from '../src/core/event-bus.js';

describe('EventBus UAT', () => {
  test('registers handler and emits events', () => {
    const bus = new EventBus();
    const handler = jest.fn();
    bus.on('ping', handler);

    bus.emit('ping', 'data');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('data');
  });

  test('removes handler so it no longer receives events', () => {
    const bus = new EventBus();
    const handler = jest.fn();
    const off = bus.on('ping', handler);

    off();
    bus.emit('ping');

    expect(handler).not.toHaveBeenCalled();
  });

  test('isolates errors thrown by handlers', () => {
    const bus = new EventBus();
    const errorHandler = jest.fn(() => {
      throw new Error('bad');
    });
    const goodHandler = jest.fn();
    bus.on('ping', errorHandler);
    bus.on('ping', goodHandler);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => bus.emit('ping')).not.toThrow();
    expect(errorHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
