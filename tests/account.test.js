describe('account page', () => {
  let supabaseMock;
  let navigateTo;
  let renderUserMenu;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = `
      <span id="userName"></span>
      <span id="userEmail"></span>
      <div id="userAvatar"></div>
      <ul id="recentLobbies"></ul>
      <button id="logoutBtn"></button>
      <button id="changePasswordBtn"></button>
      <button id="updateNameBtn"></button>
    `;
    window.history.pushState({}, '', 'http://localhost/');
    navigateTo = jest.fn();
    renderUserMenu = jest.fn();
    supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        signOut: jest.fn().mockResolvedValue({}),
        updateUser: jest.fn().mockResolvedValue({ error: null }),
      },
      from: jest.fn(() => ({
        select: () => ({
          eq: () => ({ limit: () => Promise.resolve({ data: [] }) }),
          contains: () => ({ limit: () => Promise.resolve({ data: [] }) }),
        }),
      })),
    };
    jest.doMock('../src/navigation.js', () => ({ navigateTo }));
    jest.doMock('../src/auth.js', () => ({ renderUserMenu }));
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: supabaseMock,
    }));
    window.alert = jest.fn();
    window.prompt = jest.fn();
  });

  test('loadUser fills DOM when user present', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: '1',
          email: 'foo@example.com',
          user_metadata: { name: 'Foo' },
        },
      },
    });
    require('../src/account.js');
    await Promise.resolve();
    expect(document.getElementById('userName').textContent).toBe('Foo');
    expect(document.getElementById('userEmail').textContent).toBe('foo@example.com');
    expect(document.getElementById('userAvatar').textContent).toBe('F');
  });

  test('loadLobbies renders list', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: '1' } },
    });
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [{ code: 'AAA', map: 'M1' }] }),
        }),
        contains: () => ({
          limit: () => Promise.resolve({ data: [{ code: 'BBB', map: 'M2' }] }),
        }),
      }),
    }));
    require('../src/account.js');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById('recentLobbies').innerHTML).toBe(
      '<li>AAA - M1</li><li>BBB - M2</li>',
    );
  });

  test('logout listener calls signOut and navigates home', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: '1' } },
    });
    require('../src/account.js');
    await Promise.resolve();
    await Promise.resolve();
    document.getElementById('logoutBtn').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(renderUserMenu).toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith('index.html');
  });

  test('change password listener updates via API', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: '1' } },
    });
    window.prompt.mockReturnValue('newpass');
    require('../src/account.js');
    await Promise.resolve();
    document.getElementById('changePasswordBtn').click();
    await Promise.resolve();
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
      password: 'newpass',
    });
    expect(window.alert).toHaveBeenCalledWith('Password aggiornata');
  });

  test('update name listener updates DOM via API', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: '1', email: 'x', user_metadata: { name: 'Old' } } },
    });
    window.prompt.mockReturnValue('New');
    require('../src/account.js');
    await Promise.resolve();
    document.getElementById('updateNameBtn').click();
    await Promise.resolve();
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
      data: { name: 'New' },
    });
    expect(document.getElementById('userName').textContent).toBe('New');
  });
});
