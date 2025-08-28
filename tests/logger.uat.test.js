describe('logger', () => {
  let info, warn, error, overlay;

  beforeAll(() => {
    ({ info, warn, error } = require('../src/logger.js'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    overlay = document.getElementById('error-overlay');
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    if (overlay) {
      overlay.textContent = '';
      overlay.classList.add('hidden');
    }
  });

  test('info logs with prefix', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    info('hello');
    expect(logSpy).toHaveBeenCalledWith('[INFO]', 'hello');
  });

  test('warn logs with prefix', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    warn('oops');
    expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'oops');
  });

  test('error logs with prefix', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    error('bad');
    expect(errSpy).toHaveBeenCalledWith('[ERROR]', 'bad');
  });

  test('window.onerror logs and shows overlay', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(overlay.classList.contains('hidden')).toBe(true);
    window.onerror('boom');
    expect(errSpy).toHaveBeenCalledWith('[ERROR]', 'boom');
    expect(overlay.textContent).toBe('boom');
    expect(overlay.classList.contains('hidden')).toBe(false);
  });

  test('window.onunhandledrejection logs and shows overlay', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(overlay.classList.contains('hidden')).toBe(true);
    window.onunhandledrejection({ reason: new Error('async boom') });
    expect(errSpy).toHaveBeenCalledWith('[ERROR]', 'async boom');
    expect(overlay.textContent).toBe('async boom');
    expect(overlay.classList.contains('hidden')).toBe(false);
  });
});
