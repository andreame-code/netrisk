describe('login page', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="username" />
        <input id="password" />
        <button type="submit" class="btn">Login</button>
        <a id="registerBtn" class="btn" href="./register.html">Register</a>
        <button type="button" id="anonymousBtn" class="btn">Login anonymously</button>
      </form>
      <p id="message" role="alert"></p>
    `;
  });

  test('anonymous login uses supabase', () => {
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({}),
          signInAnonymously: jest.fn().mockResolvedValue({}),
          setSession: jest.fn().mockResolvedValue({}),
        },
      },
    }));

    const { default: supabase } = require('../src/init/supabase-client.js');
    require('../src/login.js');
    document.getElementById('anonymousBtn').click();
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  test('shows message when anonymous login unsupported', () => {
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({}),
          setSession: jest.fn().mockResolvedValue({}),
        },
      },
    }));

    require('../src/login.js');
    document.getElementById('anonymousBtn').click();
    expect(document.getElementById('message').textContent).toBe('Accesso anonimo non supportato');
  });

  test('falls back to account page for external referrer after login', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://evil.com/',
      configurable: true,
    });
    jest.useFakeTimers();

    const navigateTo = jest.fn();
    jest.doMock('../src/navigation.js', () => ({ navigateTo }));

    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: { email: 'foo@example.com' } },
            error: null,
          }),
          setSession: jest.fn().mockResolvedValue({}),
        },
      },
    }));

    require('../src/login.js');
    document.getElementById('username').value = 'foo@example.com';
    document.getElementById('password').value = 'pass';
    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    jest.runAllTimers();

    expect(navigateTo).toHaveBeenCalledWith('account.html');
    jest.useRealTimers();
    Object.defineProperty(document, 'referrer', {
      value: '',
      configurable: true,
    });
  });

  test('redirects to path from query after login', async () => {
    jest.useFakeTimers();
    const navigateTo = jest.fn();
    jest.doMock('../src/navigation.js', () => ({ navigateTo }));
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: { email: 'foo@example.com' } },
            error: null,
          }),
          setSession: jest.fn().mockResolvedValue({}),
        },
      },
    }));
    const originalUrl = window.location.href;
    window.history.pushState({}, '', 'http://localhost/login.html?redirect=%2Flobby.html');
    require('../src/login.js');
    document.getElementById('username').value = 'foo@example.com';
    document.getElementById('password').value = 'pass';
    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    jest.runAllTimers();
    expect(navigateTo).toHaveBeenCalledWith('lobby.html');
    jest.useRealTimers();
    window.history.pushState({}, '', originalUrl);
  });

  test('anonymous login redirects to path from query', async () => {
    jest.useFakeTimers();
    const navigateTo = jest.fn();
    jest.doMock('../src/navigation.js', () => ({ navigateTo }));
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({}),
          signInAnonymously: jest.fn().mockResolvedValue({}),
          setSession: jest.fn().mockResolvedValue({}),
        },
      },
    }));
    const originalUrl = window.location.href;
    window.history.pushState({}, '', 'http://localhost/login.html?redirect=%2Flobby.html');
    require('../src/login.js');
    document.getElementById('anonymousBtn').click();
    await Promise.resolve();
    jest.runAllTimers();
    expect(navigateTo).toHaveBeenCalledWith('lobby.html');
    jest.useRealTimers();
    window.history.pushState({}, '', originalUrl);
  });

  test('removes localStorage token when not staying logged in', async () => {
    localStorage.setItem('supabase.auth.token', 'old');
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: { email: 'foo@example.com' }, session: {} },
            error: null,
          }),
          setSession: jest.fn().mockResolvedValue({}),
        },
      },
    }));
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="username" />
        <input id="password" />
        <input type="checkbox" id="stayLoggedIn" />
        <button type="submit">Login</button>
      </form>
      <p id="message" role="alert"></p>
    `;
    require('../src/login.js');
    document.getElementById('username').value = 'foo@example.com';
    document.getElementById('password').value = 'pass';
    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    expect(localStorage.getItem('supabase.auth.token')).toBeNull();
  });

  test('keeps token in localStorage when staying logged in', async () => {
    const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: { email: 'foo@example.com' }, session: {} },
            error: null,
          }),
          setSession: jest.fn().mockResolvedValue({}),
        },
      },
    }));
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="username" />
        <input id="password" />
        <input type="checkbox" id="stayLoggedIn" checked />
        <button type="submit">Login</button>
      </form>
      <p id="message" role="alert"></p>
    `;
    const { default: supabase } = require('../src/init/supabase-client.js');
    require('../src/login.js');
    document.getElementById('username').value = 'foo@example.com';
    document.getElementById('password').value = 'pass';
    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    expect(supabase.auth.storage).toBe(window.localStorage);
    expect(removeSpy).not.toHaveBeenCalledWith('supabase.auth.token');
    removeSpy.mockRestore();
  });
});
