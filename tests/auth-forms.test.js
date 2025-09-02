describe('auth form utility', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = `
      <form id="testForm">
        <button type="submit">Go</button>
      </form>
      <p id="authGuard" data-testid="auth-guard-msg"></p>
      <p id="message"></p>
    `;
  });

  test('shows message when supabase not configured', async () => {
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: null,
    }));
    const { setupAuthForm } = require('../src/utils/auth-forms.js');
    const handler = jest.fn();
    setupAuthForm('testForm', handler);
    document.getElementById('testForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    expect(handler).not.toHaveBeenCalled();
    expect(document.getElementById('message').textContent).toBe('Supabase non configurato');
  });

  test('calls handler when supabase available', async () => {
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: { auth: {} },
    }));
    const { setupAuthForm } = require('../src/utils/auth-forms.js');
    const handler = jest.fn().mockResolvedValue();
    setupAuthForm('testForm', handler);
    document.getElementById('testForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('initial message from query string is shown', () => {
    const originalUrl = window.location.href;
    window.history.pushState({}, '', 'http://localhost/test.html?message=hello');
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: { auth: {} },
    }));
    const { setupAuthForm } = require('../src/utils/auth-forms.js');
    setupAuthForm('testForm', jest.fn());
    expect(document.querySelector('[data-testid="auth-guard-msg"]').textContent).toBe('hello');
    window.history.pushState({}, '', originalUrl);
  });
});
