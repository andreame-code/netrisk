/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');
const { screen, waitFor } = require('@testing-library/dom');

jest.mock('../../src/theme.js', () => ({ initThemeToggle: jest.fn() }));
jest.mock('../../src/navigation.js', () => ({
  goHome: jest.fn(),
  navigateTo: jest.fn(),
}));
jest.mock('../../src/logger.js', () => ({ info: jest.fn(), error: jest.fn() }));

const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'p1',
            email: 'host@example.com',
            user_metadata: { username: 'host' },
          },
        },
      },
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'p1', user_metadata: { username: 'host' } } },
    }),
  },
  from: jest.fn(() => ({ select: jest.fn().mockResolvedValue({ data: [] }) })),
};

jest.mock('../../src/init/supabase-client.js', () => ({
  __esModule: true,
  default: mockSupabase,
}));

describe('lobby flow', () => {
  let sentMessages;
  let wsInstances;

  function setupDom() {
    const html = fs.readFileSync(path.join(__dirname, '../../lobby.html'), 'utf8');
    const dom = new JSDOM(html);
    document.body.innerHTML = dom.window.document.body.innerHTML;
  }

  beforeEach(() => {
    sentMessages = [];
    wsInstances = [];

    class MockSocket {
      static OPEN = 1;
      constructor() {
        this.readyState = 1;
        wsInstances.push(this);
        setTimeout(() => this.onopen && this.onopen(), 0);
      }
      send(data) {
        const msg = JSON.parse(data);
        sentMessages.push(msg);
        if (msg.type === 'createLobby') {
          this.onmessage &&
            this.onmessage({
              data: JSON.stringify({ type: 'joined', code: 'ABCD', id: 'p1' }),
            });
          this.onmessage &&
            this.onmessage({
              data: JSON.stringify({
                type: 'lobby',
                code: 'ABCD',
                host: 'p1',
                players: [{ id: 'p1', name: 'host' }],
                maxPlayers: 4,
              }),
            });
        } else if (msg.type === 'chat') {
          this.onmessage &&
            this.onmessage({
              data: JSON.stringify({
                type: 'chat',
                id: msg.id,
                text: msg.text,
              }),
            });
        } else if (msg.type === 'reconnect') {
          this.onmessage &&
            this.onmessage({
              data: JSON.stringify({
                type: 'reconnected',
                code: msg.code,
                player: { id: msg.id },
              }),
            });
        }
      }
      close() {
        this.readyState = 3;
        this.onclose && this.onclose();
      }
    }

    global.WebSocket = MockSocket;
    jest.doMock('../../src/config.js', () => ({ WS_URL: 'ws://test' }));

    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ maps: [] }) }));
    global.alert = jest.fn();
    localStorage.clear();
    setupDom();
  });

  afterEach(() => {
    wsInstances.forEach((ws) => ws.close());
    jest.resetModules();
  });

  test('creates lobby, exchanges chat, and shows error', async () => {
    await import('../../lobby.js');

    screen.getByTestId('create-game').click();
    screen.getByLabelText(/Room name/i).value = 'Room';
    screen.getByLabelText(/Max players/i).value = '4';
    document.getElementById('createForm').dispatchEvent(new Event('submit'));

    await waitFor(() => screen.getByText(/players: 1\/4/));

    const input = screen.getByLabelText(/Chat message/i);
    input.value = 'hello';
    document
      .getElementById('chatForm')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(sentMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'chat', text: 'hello' })]),
    );
    await waitFor(() => {
      const items = document.querySelectorAll('#chatMessages li');
      expect(items.length).toBe(1);
      expect(items[0].textContent).toMatch(/hello/);
    });

    wsInstances[0].onmessage({ data: JSON.stringify({ type: 'error' }) });
    await waitFor(() =>
      expect(screen.getByTestId('lobby-error').classList.contains('hidden')).toBe(false),
    );
  });

  test('reconnects using stored session', async () => {
    localStorage.setItem('lobbyCode', 'ABCD');
    localStorage.setItem('playerId', 'p1');

    await import('../../lobby.js');

    await waitFor(() => wsInstances.length === 1);
    wsInstances[0].onmessage({
      data: JSON.stringify({
        type: 'reconnected',
        code: 'ABCD',
        player: { id: 'p1' },
      }),
    });

    await waitFor(() => expect(localStorage.getItem('lobbyCode')).toBe('ABCD'));
    expect(screen.getByTestId('lobby-error').classList.contains('hidden')).toBe(true);
  });
});
