/** @jest-environment node */
import WebSocket from 'ws';
jest.mock('../src/init/supabase-client.js', () => null);
import { createLobbyServer } from '../src/multiplayer-server.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function onceOpen(ws) {
  return new Promise((resolve) => ws.once('open', resolve));
}

function onceClose(ws) {
  return new Promise((resolve) => ws.once('close', resolve));
}

function messageQueue(ws) {
  const q = [];
  ws.on('message', (data) => q.push(JSON.parse(data.toString())));
  return q;
}

test('lobby server manages lifecycle', async () => {
  const port = 12346;
  const server = createLobbyServer({ port });
  const url = `ws://localhost:${port}`;

  const ws1 = new WebSocket(url);
  await onceOpen(ws1);
  const q1 = messageQueue(ws1);
  ws1.send(
    JSON.stringify({
      type: 'createLobby',
      player: { id: 'p1', name: 'P1', color: '#f00' },
      maxPlayers: 5,
    }),
  );
  await wait(100);
  const lobbyMsg = q1.shift();
  const code = lobbyMsg.code;
  expect(lobbyMsg.maxPlayers).toBe(5);

  const ws2 = new WebSocket(url);
  await onceOpen(ws2);
  const q2 = messageQueue(ws2);
  ws2.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'p2', name: 'P2', color: '#0f0' },
    }),
  );
  await wait(50);
  q2.shift(); // joined
  q1.shift(); // lobby update
  q2.shift(); // lobby broadcast

  const ws3 = new WebSocket(url);
  await onceOpen(ws3);
  const q3 = messageQueue(ws3);
  ws3.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'p3', name: 'P3', color: '#00f' },
    }),
  );
  await wait(50);
  q3.shift();
  q1.shift();
  q2.shift();
  q3.shift();

  ws1.send(JSON.stringify({ type: 'selectMap', code, id: 'p1', map: 'map' }));
  await wait(50);
  const map1 = q1.shift();
  const map2 = q2.shift();
  const map3 = q3.shift();
  expect(map1.map).toBe('map');
  expect(map2.map).toBe('map');
  expect(map3.map).toBe('map');

  ws1.send(JSON.stringify({ type: 'selectMap', code, id: 'p1', map: 'invalid' }));
  await wait(50);
  const errMap = q1.shift();
  expect(errMap.error).toBe('invalidMap');

  ws1.send(JSON.stringify({ type: 'ready', code, id: 'p1', ready: true }));
  ws2.send(JSON.stringify({ type: 'ready', code, id: 'p2', ready: true }));
  ws3.send(JSON.stringify({ type: 'ready', code, id: 'p3', ready: true }));
  await wait(50);
  q1.splice(0);
  q2.splice(0);
  q3.splice(0);

  ws1.send(
    JSON.stringify({
      type: 'start',
      code,
      id: 'p1',
      state: { currentPlayer: 'p1' },
    }),
  );
  await wait(50);
  const start2 = q2.shift();
  const start3 = q3.shift();
  const start1 = q1.shift();
  expect(start2.type).toBe('start');
  expect(start3.state.currentPlayer).toBe('p1');
  expect(start1.type).toBe('start');
  expect(start2.map).toBe('map');

  const ws4 = new WebSocket(url);
  await onceOpen(ws4);
  const q4 = messageQueue(ws4);
  ws4.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'p4', name: 'P4', color: '#ff0' },
    }),
  );
  await wait(50);
  const joinErr = q4.shift();
  expect(joinErr.error).toBe('lobbyNotOpen');
  ws4.close();

  ws1.send(
    JSON.stringify({
      type: 'state',
      code,
      id: 'p1',
      state: { currentPlayer: 'p2' },
    }),
  );
  await wait(50);
  const stateMsg = q2.shift();
  expect(stateMsg.state.currentPlayer).toBe('p2');

  q1.shift(); // clear host state broadcast

  ws2.send(JSON.stringify({ type: 'chat', code, id: 'p2', text: 'hi' }));
  await wait(50);
  const chatMsg = q1.shift();
  expect(chatMsg.type).toBe('chat');
  expect(chatMsg.text).toBe('hi');

  ws3.close();
  await onceClose(ws3);
  const ws3b = new WebSocket(url);
  await onceOpen(ws3b);
  const q3b = messageQueue(ws3b);
  ws3b.send(JSON.stringify({ type: 'reconnect', code, id: 'p3' }));
  await wait(50);
  const rec = q3b.shift();
  expect(rec.type).toBe('reconnected');
  expect(rec.state.currentPlayer).toBe('p2');

  ws1.close();
  ws2.close();
  ws3b.close();
  server.close();
});

test('removes disconnected players after timeout', async () => {
  const port = 12350;
  const server = createLobbyServer({ port, offlinePlayerTimeout: 50 });
  const url = `ws://localhost:${port}`;

  const host = new WebSocket(url);
  await onceOpen(host);
  const qHost = messageQueue(host);
  host.send(
    JSON.stringify({
      type: 'createLobby',
      player: { id: 'p1', name: 'P1', color: '#f00' },
    }),
  );
  await wait(50);
  const lobbyMsg = qHost.shift();
  const code = lobbyMsg.code;

  const ws2 = new WebSocket(url);
  await onceOpen(ws2);
  const q2 = messageQueue(ws2);
  ws2.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'p2', name: 'P2', color: '#0f0' },
    }),
  );
  await wait(50);
  q2.shift();
  qHost.shift();
  q2.shift();

  ws2.close();
  await onceClose(ws2);
  await wait(20);
  const offlineMsg = qHost.shift();
  expect(offlineMsg.players.find((p) => p.id === 'p2')).toBeTruthy();

  await wait(80);
  const removedMsg = qHost.shift();
  expect(removedMsg).toBeDefined();
  expect(removedMsg.players.find((p) => p.id === 'p2')).toBeFalsy();

  host.close();
  server.close();
});

test('rejects invalid map on create', async () => {
  const port = 12348;
  const server = createLobbyServer({ port });
  const url = `ws://localhost:${port}`;
  const ws1 = new WebSocket(url);
  await onceOpen(ws1);
  const q1 = messageQueue(ws1);
  ws1.send(
    JSON.stringify({
      type: 'createLobby',
      player: { id: 'p1', name: 'P1', color: '#f00' },
      map: 'invalid',
    }),
  );
  await wait(50);
  const err = q1.shift();
  expect(err.error).toBe('invalidMap');
  ws1.close();
  server.close();
});

test('requires at least two ready players to start', async () => {
  const port = 12349;
  const server = createLobbyServer({ port });
  const url = `ws://localhost:${port}`;

  const host = new WebSocket(url);
  await onceOpen(host);
  const qHost = messageQueue(host);
  host.send(
    JSON.stringify({
      type: 'createLobby',
      player: { id: 'p1', name: 'P1' },
    }),
  );
  await wait(50);
  const { code } = qHost.shift();

  host.send(JSON.stringify({ type: 'ready', code, id: 'p1', ready: true }));
  await wait(50);
  const ready1 = qHost.shift();
  expect(ready1.players.find((p) => p.id === 'p1').ready).toBe(true);

  host.send(
    JSON.stringify({
      type: 'start',
      code,
      id: 'p1',
      state: { currentPlayer: 'p1' },
    }),
  );
  await wait(50);
  expect(qHost.length).toBe(0);

  const ws2 = new WebSocket(url);
  await onceOpen(ws2);
  const q2 = messageQueue(ws2);
  ws2.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'p2', name: 'P2' },
    }),
  );
  await wait(50);
  q2.shift();
  qHost.shift();
  q2.shift();

  host.send(
    JSON.stringify({
      type: 'start',
      code,
      id: 'p1',
      state: { currentPlayer: 'p1' },
    }),
  );
  await wait(50);
  expect(qHost.length).toBe(0);
  expect(q2.length).toBe(0);

  ws2.send(JSON.stringify({ type: 'ready', code, id: 'p2', ready: true }));
  await wait(50);
  const ready2 = qHost.shift();
  expect(ready2.players.find((p) => p.id === 'p2').ready).toBe(true);
  q2.shift();

  host.send(
    JSON.stringify({
      type: 'start',
      code,
      id: 'p1',
      state: { currentPlayer: 'p1' },
    }),
  );
  await wait(50);
  const startHost = qHost.shift();
  const start2 = q2.shift();
  expect(startHost.type).toBe('start');
  expect(start2.type).toBe('start');

  host.close();
  ws2.close();
  server.close();
});
