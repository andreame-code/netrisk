/** @jest-environment node */
import WebSocket from 'ws';

let createLobbyServer;
let mockUpsert;
let mockFrom;

beforeAll(async () => {
  mockUpsert = jest.fn().mockResolvedValue({});
  mockFrom = jest.fn(() => ({ upsert: mockUpsert }));
  jest.doMock('../src/init/supabase-client.js', () => ({
    __esModule: true,
    default: { from: mockFrom },
  }));
  ({ createLobbyServer } = await import('../src/multiplayer-server.js'));
});

function onceOpen(ws) {
  return new Promise((resolve) => ws.once('open', resolve));
}

test('persists lobby data to database on create and join', async () => {
  const port = 12355;
  const server = createLobbyServer({ port });
  const url = `ws://localhost:${port}`;

  const ws1 = new WebSocket(url);
  await onceOpen(ws1);
  const lobbyMsgPromise = new Promise((resolve) =>
    ws1.once('message', (data) => resolve(JSON.parse(data.toString()))),
  );
  ws1.send(
    JSON.stringify({
      type: 'createLobby',
      player: { id: 'p1', name: 'P1', color: '#f00' },
    }),
  );
  const lobbyMsg = await lobbyMsgPromise;
  const code = lobbyMsg.code;

  expect(mockFrom).toHaveBeenCalledWith('lobbies');
  expect(mockUpsert).toHaveBeenCalledTimes(1);
  const [row1] = mockUpsert.mock.calls[0];
  expect(row1.code).toBe(code);
  expect(row1.players).toHaveLength(1);
  expect(row1.host).toBe('p1');

  const ws2 = new WebSocket(url);
  await onceOpen(ws2);
  ws2.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'p2', name: 'P2', color: '#0f0' },
    }),
  );
  await new Promise((resolve) => {
    const check = () => {
      if (mockUpsert.mock.calls.length >= 2) resolve();
      else setTimeout(check, 10);
    };
    check();
  });

  expect(mockUpsert).toHaveBeenCalledTimes(2);
  const [row2] = mockUpsert.mock.calls[1];
  expect(row2.code).toBe(code);
  expect(row2.players).toHaveLength(2);

  const ws1Closed = new Promise((resolve) => ws1.on('close', resolve));
  const ws2Closed = new Promise((resolve) => ws2.on('close', resolve));
  ws1.close();
  ws2.close();
  await ws1Closed;
  await ws2Closed;
  await new Promise((resolve) => server.close(resolve));
});
