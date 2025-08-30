/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const { screen, waitFor } = require('@testing-library/dom');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('../../src/theme.js', () => ({ initThemeToggle: jest.fn() }));
jest.mock('../../src/navigation.js', () => ({ goHome: jest.fn() }));
jest.mock('../../src/logger.js', () => ({ info: jest.fn(), error: jest.fn() }));

// In-memory Supabase mock and tracking
const mockLobbies = [];
const upsertCalls = [];
const mockLobbiesTable = {
  select: jest.fn(async () => ({ data: mockLobbies })),
  upsert: jest.fn(async row => {
    upsertCalls.push(row);
    const idx = mockLobbies.findIndex(l => l.code === row.code);
    if (idx >= 0) mockLobbies[idx] = row;
    else mockLobbies.push(row);
    return { data: row };
  }),
};

const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({}),
    getUser: jest.fn().mockResolvedValue({ data: { user: { user_metadata: { username: 'host' } } } }),
  },
  from: jest.fn(table => {
    if (table === 'lobbies') return mockLobbiesTable;
    if (table === 'lobby_chat')
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      };
    return { select: jest.fn().mockResolvedValue({ data: [] }) };
  }),
  channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
};

jest.mock('../../src/init/supabase-client.js', () => ({ __esModule: true, default: mockSupabase }));

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('lobby lifecycle flow', async () => {
  // Minimal in-memory WebSocket server
  function createServer() {
    const serverLobbies = new Map();
    const clients = new Set();
    class MockSocket {
      constructor() {
        this.readyState = 1;
        clients.add(this);
        setTimeout(() => this.onopen && this.onopen(), 0);
      }
      send(data) {
        const msg = JSON.parse(data);
        if (msg.type === 'createLobby') {
          const code = 'abcd';
          const player = { id: msg.player?.id || 'p1', name: msg.player?.name || 'host', ready: false, ws: this };
          const lobby = {
            code,
            host: player.id,
            players: [player],
            started: false,
            map: msg.map || null,
            maxPlayers: msg.maxPlayers || 8,
          };
          serverLobbies.set(code, lobby);
          mockSupabase.from('lobbies').upsert({
            code,
            host: lobby.host,
            players: lobby.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
            started: false,
            current_player: null,
            state: null,
            map: lobby.map,
            max_players: lobby.maxPlayers,
          });
          this.code = code;
          this.id = player.id;
          this.onmessage &&
            this.onmessage({
              data: JSON.stringify({
                type: 'lobby',
                code,
                host: lobby.host,
                players: lobby.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
                map: lobby.map,
                maxPlayers: lobby.maxPlayers,
              }),
            });
        } else if (msg.type === 'joinLobby') {
          const lobby = serverLobbies.get(msg.code);
          if (!lobby || lobby.started || lobby.players.length >= lobby.maxPlayers) {
            this.onmessage && this.onmessage({ data: JSON.stringify({ type: 'error', error: 'lobbyNotOpen' }) });
            return;
          }
          const player = { id: msg.player?.id || `p${lobby.players.length + 1}`, name: msg.player?.name || '', ready: false, ws: this };
          lobby.players.push(player);
          this.code = lobby.code;
          this.id = player.id;
          this.onmessage && this.onmessage({ data: JSON.stringify({ type: 'joined', code: lobby.code, id: player.id }) });
          mockSupabase.from('lobbies').upsert({
            code: lobby.code,
            host: lobby.host,
            players: lobby.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
            started: lobby.started,
            current_player: null,
            state: null,
            map: lobby.map,
            max_players: lobby.maxPlayers,
          });
          lobby.players.forEach(p => {
            p.ws.onmessage &&
              p.ws.onmessage({
                data: JSON.stringify({
                  type: 'lobby',
                  code: lobby.code,
                  host: lobby.host,
                  players: lobby.players.map(pp => ({ id: pp.id, name: pp.name, ready: pp.ready })),
                  map: lobby.map,
                  maxPlayers: lobby.maxPlayers,
                }),
              });
          });
        } else if (msg.type === 'ready') {
          const lobby = serverLobbies.get(msg.code);
          if (!lobby) return;
          const player = lobby.players.find(p => p.id === msg.id);
          if (!player) return;
          player.ready = !!msg.ready;
          mockSupabase.from('lobbies').upsert({
            code: lobby.code,
            host: lobby.host,
            players: lobby.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
            started: lobby.started,
            current_player: null,
            state: lobby.state || null,
            map: lobby.map,
            max_players: lobby.maxPlayers,
          });
          lobby.players.forEach(p => {
            p.ws.onmessage &&
              p.ws.onmessage({
                data: JSON.stringify({
                  type: 'lobby',
                  code: lobby.code,
                  host: lobby.host,
                  players: lobby.players.map(pp => ({ id: pp.id, name: pp.name, ready: pp.ready })),
                  map: lobby.map,
                  maxPlayers: lobby.maxPlayers,
                }),
              });
          });
        } else if (msg.type === 'start') {
          const lobby = serverLobbies.get(msg.code);
          if (!lobby || lobby.host !== msg.id) return;
          if (lobby.players.length < 2) return;
          if (!lobby.players.every(p => p.ready)) return;
          lobby.started = true;
          lobby.state = msg.state;
          mockSupabase.from('lobbies').upsert({
            code: lobby.code,
            host: lobby.host,
            players: lobby.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
            started: true,
            current_player: lobby.state?.currentPlayer || null,
            state: lobby.state,
            map: lobby.map,
            max_players: lobby.maxPlayers,
          });
          lobby.players.forEach(p => {
            p.ws.onmessage && p.ws.onmessage({ data: JSON.stringify({ type: 'start', state: lobby.state }) });
          });
        }
      }
      close() {}
    }
    return { WebSocket: MockSocket };
  }

  const server = createServer();
  const wsInstances = [];
  class ClientSocket extends server.WebSocket {
    constructor() {
      super();
      wsInstances.push(this);
    }
  }
  global.WebSocket = ClientSocket;

  jest.doMock('../../src/config.js', () => ({ WS_URL: 'ws://test' }));

  global.alert = jest.fn();
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ maps: [] }) }));

  const html = fs.readFileSync(path.resolve(__dirname, '../../lobby.html'), 'utf8');
  const dom = new (require('jsdom').JSDOM)(html);
  document.body.innerHTML = dom.window.document.body.innerHTML;

  await import('../../lobby.js');
  await wait(50);

  // Create lobby via UI
  screen.getByRole('button', { name: /Create new game/i }).click();
  screen.getByLabelText(/Room name/i).value = 'Room';
  screen.getByLabelText(/Max players/i).value = '4';
  document.getElementById('createForm').dispatchEvent(new Event('submit'));

  await waitFor(() => screen.getByText(/players: 1\/4/));
  expect(upsertCalls[0].started).toBe(false); // lobby persisted as open
  const code = upsertCalls[0].code;
  const hostId = upsertCalls[0].host;

  // Start before enough players -> no change
  wsInstances[0].send(
    JSON.stringify({ type: 'start', code, id: hostId, state: { currentPlayer: hostId } })
  );
  await wait(10);
  expect(upsertCalls[upsertCalls.length - 1].started).toBe(false);

  // Second player joins
  const ws2 = new ClientSocket();
  await wait(10);
  ws2.send(
    JSON.stringify({ type: 'joinLobby', code, player: { id: 'p2', name: 'P2' } })
  );
  await wait(10);
  await waitFor(() => screen.getByText(/players: 2\/4/));

  // Start before ready -> still open
  wsInstances[0].send(
    JSON.stringify({ type: 'start', code, id: hostId, state: { currentPlayer: hostId } })
  );
  await wait(10);
  expect(upsertCalls[upsertCalls.length - 1].started).toBe(false);

  // Both players ready then start
  wsInstances[0].send(JSON.stringify({ type: 'ready', code, id: hostId, ready: true }));
  ws2.send(JSON.stringify({ type: 'ready', code, id: 'p2', ready: true }));
  await wait(10);
  wsInstances[0].send(
    JSON.stringify({ type: 'start', code, id: hostId, state: { currentPlayer: hostId } })
  );
  await wait(10);
  expect(upsertCalls[upsertCalls.length - 1].started).toBe(true);

  // Further joins are blocked
  const ws3 = new ClientSocket();
  const msgs = [];
  ws3.onmessage = e => msgs.push(JSON.parse(e.data));
  await wait(10);
  ws3.send(
    JSON.stringify({ type: 'joinLobby', code, player: { id: 'p3', name: 'P3' } })
  );
  await wait(10);
  expect(msgs[0].error).toBe('lobbyNotOpen');

  ws3.close();
  ws2.close();
  wsInstances[0].close();
});

