describe('auth menu integration', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '<nav><div id="userMenu" class="loading"></div></nav>';
    const store = {};
    const mockSessionStorage = {
      getItem: jest.fn((key) => store[key]),
      setItem: jest.fn((key, value) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete store[key];
      }),
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });
  });

  test('shows login and register when logged out', async () => {
    const getSession = jest.fn().mockResolvedValue({ data: { session: null } });
    jest.doMock('../../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: { auth: { getSession } },
      registerAuthListener: jest.fn(),
    }));
    await require('../../src/auth.js');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(getSession).toHaveBeenCalled();
    expect(document.querySelector('#userMenu a[href="login.html"]')).not.toBeNull();
    expect(document.querySelector('#userMenu a[href="register.html"]')).not.toBeNull();
  });

  test('shows profile and logout when logged in', async () => {
    const session = {
      user: {
        id: 'u1',
        email: 'foo@example.com',
        user_metadata: { username: 'foo' },
      },
    };
    const getSession = jest.fn().mockResolvedValue({ data: { session } });
    jest.doMock('../../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: { auth: { getSession } },
      registerAuthListener: jest.fn(),
    }));
    await require('../../src/auth.js');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(getSession).toHaveBeenCalled();
    expect(document.querySelector('#userMenu a[href="account.html"]')).not.toBeNull();
    expect(document.querySelector('#userMenu a[href="#"]')).not.toBeNull();
  });
});
