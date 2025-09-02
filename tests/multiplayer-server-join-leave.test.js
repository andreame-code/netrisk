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
  return ws.readyState === WebSocket.CLOSED
    ? Promise.resolve()
    : new Promise((resolve) => ws.once('close', resolve));
}
function messageQueue(ws) {
  const q = [];
  ws.on('message', (data) => q.push(JSON.parse(data.toString())));
  return q;
}

test.skip('enforces max players and closes empty lobby', async () => {
  // Use a random port to avoid conflicts across parallel test runs.
  const server = createLobbyServer({
    port: 0,
    closeEmptyLobbiesAfter: 50,
    maxPlayers: 6,
  });
  const { port } = server.address();
  const url = `ws://localhost:${port}`;

  const host = new WebSocket(url);
  await onceOpen(host);
  const qHost = messageQueue(host);
  host.send(
    JSON.stringify({
      type: 'createLobby',
      player: { id: 'p1', name: 'P1', color: '#f00' },
      maxPlayers: 6,
    }),
  );
  await wait(50);
  const lobbyMsg = qHost.shift();
  const code = lobbyMsg.code;

  const clients = [];
  for (let i = 2; i <= 5; i++) {
    const ws = new WebSocket(url);
    await onceOpen(ws);
    const q = messageQueue(ws);
    ws.send(
      JSON.stringify({
        type: 'joinLobby',
        code,
        player: { id: `p${i}`, name: `P${i}`, color: '#000' },
      }),
    );
    await wait(20);
    q.shift(); // joined
    clients.push({ ws, q, id: `p${i}` });
  }
  qHost.splice(0); // clear join broadcasts

  const wsA = new WebSocket(url);
  const wsB = new WebSocket(url);
  await onceOpen(wsA);
  await onceOpen(wsB);
  const qA = messageQueue(wsA);
  const qB = messageQueue(wsB);
  wsA.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'p6', name: 'P6', color: '#aaa' },
    }),
  );
  wsB.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'p7', name: 'P7', color: '#bbb' },
    }),
  );
  await wait(100);
  const respA = qA.shift();
  const respB = qB.shift();
  expect([respA.type, respB.type].sort()).toEqual(['error', 'joined']);
  expect(respA.error || respB.error).toBe('lobbyFull');

  let joinedWs, joinedId, rejectedWs;
  if (respA.type === 'joined') {
    joinedWs = wsA;
    joinedId = 'p6';
    rejectedWs = wsB;
  } else {
    joinedWs = wsB;
    joinedId = 'p7';
    rejectedWs = wsA;
  }
  qHost.splice(0); // clear join broadcast
  joinedWs.send(JSON.stringify({ type: 'leaveLobby', code, id: joinedId }));
  await wait(80);
  const update = qHost.shift();
  expect(update.players.length).toBe(5);

  qHost.splice(0);
  host.send(JSON.stringify({ type: 'leaveLobby', code, id: 'p1' }));
  for (const c of clients) {
    c.ws.send(JSON.stringify({ type: 'leaveLobby', code, id: c.id }));
  }
  await wait(100);

  const wsNew = new WebSocket(url);
  await onceOpen(wsNew);
  const qNew = messageQueue(wsNew);
  wsNew.send(
    JSON.stringify({
      type: 'joinLobby',
      code,
      player: { id: 'px', name: 'PX', color: '#ccc' },
    }),
  );
  await wait(100);
  const err = qNew.shift();
  expect(err.error).toBe('lobbyNotOpen');

  const closePromises = [
    onceClose(wsNew),
    onceClose(joinedWs),
    onceClose(rejectedWs),
    ...clients.map((c) => onceClose(c.ws)),
    onceClose(host),
  ];
  wsNew.close();
  joinedWs.close();
  rejectedWs.close();
  for (const c of clients) c.ws.close();
  host.close();
  await Promise.all(closePromises);
  await new Promise((resolve) => server.close(resolve));
}, 20000);
