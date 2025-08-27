jest.mock('../src/navigation.js', () => ({ goHome: jest.fn() }));
jest.mock('../src/theme.js', () => ({ initThemeToggle: jest.fn() }));
jest.mock('../src/init/supabase-client.js', () => null);

describe('lobby screen', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../src/config.js', () => ({ WS_URL: 'ws://test' }));
    global.alert = jest.fn();
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ maps: [{ id: 'map', name: 'Classic' }] }) })
    );
    document.body.innerHTML = `
      <button id="backBtn" class="btn"></button>
      <button id="createBtn" class="btn"></button>
      <ul id="lobbyList"></ul>
      <dialog id="createDialog">
        <form id="createForm">
          <input id="roomName" />
          <input id="maxPlayers" />
          <select id="map"></select>
        </form>
      </dialog>
      <ul id="chatMessages"></ul>
      <form id="chatForm"><input id="chatInput" /></form>
    `;
  });

  afterEach(() => {
    delete global.fetch;
    delete global.alert;
    localStorage.clear();
  });

  test('back button goes home', () => {
    const { goHome } = require('../src/navigation.js');
    require('../src/lobby.js');
    document.getElementById('backBtn').click();
    expect(goHome).toHaveBeenCalled();
  });

  test('renderLobbies displays info', () => {
    const { renderLobbies } = require('../src/lobby.js');
    const data = [
      { code: 'abc', host: 'host', players: [{}, {}], map: 'map', started: false, maxPlayers: 5 },
    ];
    renderLobbies(data);
    const text = document.getElementById('lobbyList').textContent;
    expect(text).toContain('abc');
    expect(text).toContain('host');
    expect(text).toContain('2/5');
    expect(text).toContain('map');
    expect(text).toContain('open');
  });

  test('create game flow validates and sends message', async () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require('../src/lobby.js');
    document.getElementById('createBtn').click();
    expect(document.getElementById('createDialog').hasAttribute('open')).toBe(true);
    document.getElementById('roomName').value = 'Room';
    document.getElementById('maxPlayers').value = '4';
    await new Promise(r => setTimeout(r, 0));
    document.getElementById('map').value = 'map';
    document.getElementById('createForm').dispatchEvent(new Event('submit'));
    expect(WebSocket).toHaveBeenCalled();
    wsInstance.onopen();
    expect(wsInstance.send).toHaveBeenCalled();
    const msg = JSON.parse(wsInstance.send.mock.calls[0][0]);
    expect(msg.type).toBe('createLobby');
    expect(msg.player.name).toBe('Room');
    expect(msg.maxPlayers).toBe(4);
    expect(msg.map).toBe('map');
    wsInstance.onmessage({ data: JSON.stringify({ type: 'lobby', code: 'abc', host: 'p1', players: [{ id: 'p1' }], map: 'map', maxPlayers: 4 }) });
    const text = document.getElementById('lobbyList').textContent;
    expect(text).toContain('abc');
    expect(text).toContain('1/4');
    delete global.WebSocket;
  });

  test('invalid form does not send', () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require('../src/lobby.js');
    document.getElementById('createBtn').click();
    document.getElementById('roomName').value = '';
    document.getElementById('maxPlayers').value = '10';
    document.getElementById('createForm').dispatchEvent(new Event('submit'));
    expect(WebSocket).not.toHaveBeenCalled();
    delete global.WebSocket;
  });

  test('chat sends and renders messages', async () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require('../src/lobby.js');
    document.getElementById('createBtn').click();
    document.getElementById('roomName').value = 'Room';
    document.getElementById('maxPlayers').value = '2';
    await new Promise(r => setTimeout(r, 0));
    document.getElementById('map').value = '';
    document.getElementById('createForm').dispatchEvent(new Event('submit'));
    wsInstance.onopen();
    wsInstance.onmessage({ data: JSON.stringify({ type: 'lobby', code: 'abc', host: 'p1', players: [{ id: 'p1', name: 'Host' }], map: null, maxPlayers: 2 }) });
    document.getElementById('chatInput').value = 'hello';
    document.getElementById('chatForm').dispatchEvent(new Event('submit'));
    expect(wsInstance.send).toHaveBeenLastCalledWith(
      JSON.stringify({ type: 'chat', code: 'abc', id: 'p1', text: 'hello' })
    );
    wsInstance.onmessage({ data: JSON.stringify({ type: 'chat', id: 'p1', text: 'hello' }) });
    const text = document.getElementById('chatMessages').textContent;
    expect(text).toContain('Host');
    expect(text).toContain('hello');
    delete global.WebSocket;
  });

  test('reconnects when stored credentials are present', () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    localStorage.setItem('lobbyCode', 'abc');
    localStorage.setItem('playerId', 'p1');
    require('../src/lobby.js');
    wsInstance.onopen();
    expect(wsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'reconnect', code: 'abc', id: 'p1' })
    );
    delete global.WebSocket;
  });

  test('disables create button when WS_URL missing', () => {
    jest.resetModules();
    jest.doMock('../src/config.js', () => ({ WS_URL: '' }));
    require('../src/lobby.js');
    expect(document.getElementById('createBtn').disabled).toBe(true);
    expect(global.alert).toHaveBeenCalled();
  });

  test('notifies user on websocket error', async () => {
    const wsInstance = { send: jest.fn(), readyState: 1 };
    global.WebSocket = jest.fn(() => wsInstance);
    global.WebSocket.OPEN = 1;
    require('../src/lobby.js');
    document.getElementById('createBtn').click();
    document.getElementById('roomName').value = 'Room';
    document.getElementById('maxPlayers').value = '2';
    await new Promise(r => setTimeout(r, 0));
    document.getElementById('map').value = '';
    document.getElementById('createForm').dispatchEvent(new Event('submit'));
    wsInstance.onopen();
    wsInstance.onerror();
    expect(global.alert).toHaveBeenCalled();
    delete global.WebSocket;
  });
});
