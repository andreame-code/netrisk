jest.mock('../src/navigation.js', () => ({ goHome: jest.fn() }));
jest.mock('../src/theme.js', () => ({ initThemeToggle: jest.fn() }));

describe('lobby user acceptance tests', () => {
  let supabaseMock;
  let wsInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../src/config.js', () => ({ WS_URL: 'ws://test' }));
    jest.useFakeTimers();
    document.body.innerHTML = `
      <button id="backBtn" class="btn"></button>
      <button id="createBtn" class="btn"></button>
      <ul id="lobbyList"></ul>
      <dialog id="createDialog">
        <form id="createForm">
          <input id="roomName" />
          <input id="maxPlayers" />
          <select id="map"></select>
          <menu>
            <button type="button" id="cancelCreate" value="cancel">Cancel</button>
            <button id="submitCreate" value="default">Create</button>
          </menu>
        </form>
      </dialog>
      <ul id="chatMessages"></ul>
      <form id="chatForm"><input id="chatInput" /></form>
    `;
    global.alert = jest.fn();
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ maps: [] }) })
    );
    supabaseMock = {
      from: jest.fn(table => {
        if (table === 'lobbies') {
          return {
            select: jest.fn().mockResolvedValue({ data: [] })
          };
        }
        if (table === 'lobby_chat') {
          return {
            select() { return this; },
            eq() { return this; },
            order: jest.fn().mockResolvedValue({ data: [{ id: 'p1', text: 'hi', created_at: new Date().toISOString() }] })
          };
        }
        return { select: jest.fn().mockResolvedValue({ data: [] }) };
      }),
      auth: { getSession: jest.fn().mockResolvedValue(null) },
      channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() }))
    };
    jest.doMock('../src/init/supabase-client.js', () => supabaseMock);
    wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    delete global.fetch;
    delete global.alert;
    delete global.WebSocket;
    jest.useRealTimers();
  });

  test('renderLobbies handles empty list', async () => {
    require('../src/lobby.js');
    await Promise.resolve();
    await Promise.resolve();
    const list = document.getElementById('lobbyList');
    expect(list.children.length).toBe(0);
  });

  test('fetchLobbies populates lobby list', async () => {
    supabaseMock.from = jest.fn(table => ({
      select: jest.fn().mockResolvedValue({
        data: [
          { code: 'xyz', host: 'host', players: [{}, {}], map: 'map', started: false, maxPlayers: 5 }
        ]
      })
    }));
    require('../src/lobby.js');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const text = document.getElementById('lobbyList').textContent;
    expect(text).toContain('xyz');
    expect(text).toContain('2/5');
  });

  test('createGame, handleMessage, addChatMessage and startHeartbeat integrate', async () => {
    require('../src/lobby.js');
    await Promise.resolve();
    document.getElementById('createBtn').click();
    document.getElementById('roomName').value = 'Room';
    document.getElementById('maxPlayers').value = '4';
    await Promise.resolve();
    document.getElementById('createForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    wsInstance.onopen();
    expect(wsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'createLobby',
        player: { name: 'Room' },
        maxPlayers: 4
      })
    );
    wsInstance.onmessage({ data: JSON.stringify({ type: 'joined', code: 'abc', id: 'p1' }) });
    await Promise.resolve();
    wsInstance.onmessage({ data: JSON.stringify({ type: 'lobby', code: 'abc', host: 'p1', players: [{ id: 'p1', name: 'Host' }], map: null, maxPlayers: 4 }) });
    wsInstance.onmessage({ data: JSON.stringify({ type: 'chat', id: 'p1', text: 'hello' }) });
    const chatText = document.getElementById('chatMessages').textContent;
    expect(chatText).toContain('Host');
    expect(chatText).toContain('hello');
    jest.advanceTimersByTime(30000);
    expect(wsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'heartbeat', code: 'abc', id: 'p1' })
    );
  });

  test('loadChatHistory retrieves messages once', async () => {
    localStorage.setItem('lobbyCode', 'abc');
    localStorage.setItem('playerId', 'p1');
    require('../src/lobby.js');
    await Promise.resolve();
    await Promise.resolve();
    wsInstance.onopen();
    wsInstance.onmessage({ data: JSON.stringify({ type: 'joined', code: 'abc', id: 'p1' }) });
    await Promise.resolve();
    await Promise.resolve();
    const text = document.getElementById('chatMessages').textContent;
    expect(text).toContain('hi');
    expect(supabaseMock.from).toHaveBeenCalledWith('lobby_chat');
    wsInstance.onmessage({ data: JSON.stringify({ type: 'joined', code: 'abc', id: 'p1' }) });
    await Promise.resolve();
    await Promise.resolve();
    const chatCalls = supabaseMock.from.mock.calls.filter(c => c[0] === 'lobby_chat');
    expect(chatCalls.length).toBe(1);
  });

  test('server error notifies user', () => {
    localStorage.setItem('lobbyCode', 'abc');
    localStorage.setItem('playerId', 'p1');
    require('../src/lobby.js');
    wsInstance.onopen();
    wsInstance.onmessage({ data: JSON.stringify({ type: 'error', error: 'oops' }) });
    expect(global.alert).toHaveBeenCalledWith('oops');
  });

  test('reconnect attempts when credentials stored', () => {
    localStorage.setItem('lobbyCode', 'abc');
    localStorage.setItem('playerId', 'p1');
    require('../src/lobby.js');
    wsInstance.onopen();
    expect(wsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'reconnect', code: 'abc', id: 'p1' })
    );
  });
});

