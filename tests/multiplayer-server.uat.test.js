/** @jest-environment node */
import WebSocket from "ws";
jest.mock("../src/init/supabase-client.js", () => null);
const { createLobbyServer } = require("../src/multiplayer-server.js");

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function onceOpen(ws) {
  return new Promise(resolve => ws.once("open", resolve));
}

function onceClose(ws) {
  return new Promise(resolve => ws.once("close", resolve));
}

function messageQueue(ws) {
  const q = [];
  ws.on("message", data => q.push(JSON.parse(data.toString())));
  return q;
}

test("lobby creation, chat broadcast and state sync", async () => {
  const port = 13000 + Math.floor(Math.random() * 1000);
  const server = createLobbyServer({ port });
  const url = `ws://localhost:${port}`;

  const host = new WebSocket(url);
  await onceOpen(host);
  const qHost = messageQueue(host);
  host.send(
    JSON.stringify({
      type: "createLobby",
      player: { id: "h", name: "Host" },
    })
  );
  await wait(50);
  const lobbyMsg = qHost.shift();
  const code = lobbyMsg.code;

  const client = new WebSocket(url);
  await onceOpen(client);
  const qClient = messageQueue(client);
  client.send(
    JSON.stringify({
      type: "joinLobby",
      code,
      player: { id: "c", name: "Client" },
    })
  );
  await wait(50);
  qClient.shift(); // joined
  qHost.shift(); // lobby broadcast to host
  qClient.shift(); // lobby broadcast to client

  client.send(
    JSON.stringify({ type: "chat", code, id: "c", text: "hello" })
  );
  await wait(50);
  const chatHost = qHost.shift();
  const chatClient = qClient.shift();
  expect(chatHost).toEqual({ type: "chat", id: "c", text: "hello" });
  expect(chatClient).toEqual({ type: "chat", id: "c", text: "hello" });

  host.send(JSON.stringify({ type: "ready", code, id: "h", ready: true }));
  client.send(JSON.stringify({ type: "ready", code, id: "c", ready: true }));
  await wait(50);
  qHost.splice(0);
  qClient.splice(0);

  host.send(
    JSON.stringify({
      type: "start",
      code,
      id: "h",
      state: { currentPlayer: "h", turn: 1 },
    })
  );
  await wait(50);
  const startHost = qHost.shift();
  const startClient = qClient.shift();
  expect(startHost.type).toBe("start");
  expect(startClient.state.currentPlayer).toBe("h");

  host.send(
    JSON.stringify({
      type: "state",
      code,
      id: "h",
      state: { currentPlayer: "c", turn: 2 },
    })
  );
  await wait(50);
  const stateHost = qHost.shift();
  const stateClient = qClient.shift();
  expect(stateHost.type).toBe("state");
  expect(stateClient.state.turn).toBe(2);
  expect(stateClient.state.currentPlayer).toBe("c");

  const closePromises = [onceClose(host), onceClose(client)];
  host.close();
  client.close();
  await Promise.all(closePromises);
  await new Promise(resolve => server.close(resolve));
});

test("supports reconnection and removes offline players after timeout", async () => {
  const port = 14000 + Math.floor(Math.random() * 1000);
  const server = createLobbyServer({ port, offlinePlayerTimeout: 50 });
  const url = `ws://localhost:${port}`;

  const host = new WebSocket(url);
  await onceOpen(host);
  const qHost = messageQueue(host);
  host.send(
    JSON.stringify({
      type: "createLobby",
      player: { id: "h", name: "Host" },
    })
  );
  await wait(50);
  const { code } = qHost.shift();

  const client = new WebSocket(url);
  await onceOpen(client);
  const qClient = messageQueue(client);
  client.send(
    JSON.stringify({
      type: "joinLobby",
      code,
      player: { id: "c", name: "Client" },
    })
  );
  await wait(50);
  qClient.shift();
  qHost.shift();
  qClient.shift();

  const close1 = onceClose(client);
  client.close();
  await close1;
  await wait(20);
  const offlineMsg = qHost.shift();
  expect(offlineMsg.players.find(p => p.id === "c")?.connected).toBe(false);

  const clientR = new WebSocket(url);
  await onceOpen(clientR);
  const qClientR = messageQueue(clientR);
  clientR.send(JSON.stringify({ type: "reconnect", code, id: "c" }));
  await wait(50);
  const reconnected = qClientR.shift();
  expect(reconnected.type).toBe("reconnected");
  qClientR.shift(); // lobby broadcast to client
  const reconnectBroadcast = qHost.shift();
  expect(reconnectBroadcast.players.find(p => p.id === "c")?.connected).toBe(
    true
  );

  const close2 = onceClose(clientR);
  clientR.close();
  await close2;
  await wait(20);
  const offline2 = qHost.shift();
  expect(offline2.players.find(p => p.id === "c")).toBeTruthy();
  await wait(80);
  const removed = qHost.shift();
  expect(removed.players.find(p => p.id === "c")).toBeFalsy();

  const closeHost = onceClose(host);
  host.close();
  await closeHost;
  await new Promise(resolve => server.close(resolve));
});
