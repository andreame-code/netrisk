describe('auth menu', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '<nav class="loading"><span id="userMenu" class="user-menu loading"></span></nav>';
    Object.defineProperty(window, 'sessionStorage', {
      value: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
      configurable: true,
    });
  });

  test('shows logged out menu when supabase is null', async () => {
    jest.doMock('../src/init/supabase-client.js', () => ({ __esModule: true, default: null }));
    jest.doMock('../src/navigation.js', () => ({ navigateTo: jest.fn() }));
    jest.doMock('../src/logger.js', () => ({ info: jest.fn(), error: jest.fn() }));

    require('../src/auth.js');
    await Promise.resolve();

    const menu = document.getElementById('userMenu');
    expect(menu.textContent).toContain('Accedi');
    expect(menu.textContent).toContain('Registrati');
    expect(menu.classList.contains('loading')).toBe(false);
    expect(menu.closest('nav').classList.contains('loading')).toBe(false);
  });

  test('shows logged out menu when there is no session', async () => {
    const getSession = jest.fn().mockResolvedValue({ data: { session: null } });
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: { auth: { getSession, signOut: jest.fn() } },
    }));
    jest.doMock('../src/navigation.js', () => ({ navigateTo: jest.fn() }));
    jest.doMock('../src/logger.js', () => ({ info: jest.fn(), error: jest.fn() }));

    require('../src/auth.js');
    await Promise.resolve();

    const menu = document.getElementById('userMenu');
    expect(getSession).toHaveBeenCalled();
    expect(menu.textContent).toContain('Accedi');
    expect(menu.textContent).toContain('Registrati');
    expect(menu.classList.contains('loading')).toBe(false);
    expect(menu.closest('nav').classList.contains('loading')).toBe(false);
  });

  test('shows profile and logout when user is authenticated', async () => {
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { email: 'foo@example.com' } } },
          }),
          signOut: jest.fn(),
        },
      },
    }));
    jest.doMock('../src/navigation.js', () => ({ navigateTo: jest.fn() }));
    jest.doMock('../src/logger.js', () => ({ info: jest.fn(), error: jest.fn() }));

    require('../src/auth.js');
    await Promise.resolve();

    const menu = document.getElementById('userMenu');
    expect(menu.textContent).toContain('Profilo');
    expect(menu.textContent).toContain('Esci');
    expect(menu.classList.contains('loading')).toBe(false);
    expect(menu.closest('nav').classList.contains('loading')).toBe(false);
  });

  test('signs out and navigates home on logout click', async () => {
    const signOut = jest.fn().mockResolvedValue({});
    const getSession = jest
      .fn()
      .mockResolvedValueOnce({ data: { session: { user: { email: 'foo@example.com' } } } })
      .mockResolvedValueOnce({ data: { session: null } });
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: { auth: { getSession, signOut } },
    }));
    const navigateTo = jest.fn();
    jest.doMock('../src/navigation.js', () => ({ navigateTo }));
    jest.doMock('../src/logger.js', () => ({ info: jest.fn(), error: jest.fn() }));

    require('../src/auth.js');
    await Promise.resolve();

    const menu = document.getElementById('userMenu');
    const logout = Array.from(menu.querySelectorAll('a')).find((a) => a.textContent === 'Esci');
    logout.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith('flashMessage', "Sei uscito dall'account");
    expect(navigateTo).toHaveBeenCalledWith('index.html');
  });
});
