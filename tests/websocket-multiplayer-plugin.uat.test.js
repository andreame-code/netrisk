/** @jest-environment node */
import Game from "../src/game.js";
import { FORTIFY } from "../src/phases.js";
import createWebSocketMultiplayer from "../src/plugins/websocket-multiplayer-plugin.js";

function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class MockServer {
  constructor() {
    this.clients = new Set();
  }
  connect(ws) {
    this.clients.add(ws);
    setTimeout(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws._emit("open");
    }, 0);
  }
  disconnect(ws) {
    this.clients.delete(ws);
  }
  broadcast(sender, data) {
    for (const client of this.clients) {
      if (client !== sender && client.readyState === MockWebSocket.OPEN) {
        setTimeout(() => client._emit("message", { data }), 0);
      }
    }
  }
  sendTo(client, data) {
    if (this.clients.has(client) && client.readyState === MockWebSocket.OPEN) {
      setTimeout(() => client._emit("message", { data }), 0);
    }
  }
}

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static servers = new Map();
  static instances = [];
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.readyState = 0; // CONNECTING
    let server = MockWebSocket.servers.get(url);
    if (!server) {
      server = new MockServer();
      MockWebSocket.servers.set(url, server);
    }
    this.server = server;
    this.server.connect(this);
    MockWebSocket.instances.push(this);
  }
  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }
  _emit(type, event = {}) {
    (this.listeners[type] || []).forEach(fn => fn(event));
  }
  send(data) {
    this.server.broadcast(this, data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.server.disconnect(this);
    setTimeout(() => this._emit("close"), 0);
  }
}

afterEach(() => {
  MockWebSocket.servers.clear();
  MockWebSocket.instances = [];
  delete global.WebSocket;
});

test("syncs game state and emits events", async () => {
  global.WebSocket = MockWebSocket;
  const url = "ws://test";

  const players = [
    { name: "P1", color: "#f00" },
    { name: "P2", color: "#0f0" },
  ];
  const territories = [
    { id: 0, neighbors: [1], x: 0, y: 0, owner: 0, armies: 3 },
    { id: 1, neighbors: [0], x: 1, y: 0, owner: 1, armies: 3 },
  ];

  const game1 = new Game(players, territories, [], [], false, false);
  const game2 = new Game(players, territories, [], [], false, false);

  const events2 = [];
  game2.on("turnStart", e => events2.push(e));

  createWebSocketMultiplayer(url)(game1);
  createWebSocketMultiplayer(url)(game2);
  await wait(5);

  game1.setPhase(FORTIFY);
  game1.endTurn();
  await wait();

  expect(game2.getCurrentPlayer()).toBe(1);
  expect(events2).toEqual([{ player: 1 }]);
});

test("reconnects and handles messages after reconnect", async () => {
  global.WebSocket = MockWebSocket;
  const url = "ws://reconnect";

  const players = [
    { name: "P1", color: "#f00" },
    { name: "P2", color: "#0f0" },
  ];
  const territories = [
    { id: 0, neighbors: [1], x: 0, y: 0, owner: 0, armies: 3 },
    { id: 1, neighbors: [0], x: 1, y: 0, owner: 1, armies: 3 },
  ];

  const game1 = new Game(players, territories, [], [], false, false);
  const game2 = new Game(players, territories, [], [], false, false);

  const events2 = [];
  game2.on("turnStart", e => events2.push(e));

  createWebSocketMultiplayer(url)(game1);
  createWebSocketMultiplayer(url)(game2);
  await wait(5);

  // disconnect game2
  const ws2 = MockWebSocket.instances[1];
  ws2.close();
  await wait(5);

  // change state while disconnected
  game1.setPhase(FORTIFY);
  game1.endTurn();
  await wait(5);
  expect(game2.getCurrentPlayer()).toBe(0);
  expect(events2).toEqual([]);

  // reconnect game2
  createWebSocketMultiplayer(url)(game2);
  await wait(10);

  // send another update
  game1.setPhase(FORTIFY);
  game1.endTurn();
  await wait(10);

  expect(game2.getCurrentPlayer()).toBe(1);
  expect(events2).toEqual([{ player: 1 }]);
});

test("ignores non-state messages", async () => {
  global.WebSocket = MockWebSocket;
  const url = "ws://ignore";

  const players = [
    { name: "P1", color: "#f00" },
    { name: "P2", color: "#0f0" },
  ];
  const territories = [
    { id: 0, neighbors: [1], x: 0, y: 0, owner: 0, armies: 3 },
    { id: 1, neighbors: [0], x: 1, y: 0, owner: 1, armies: 3 },
  ];

  const game = new Game(players, territories, [], [], false, false);
  const events = [];
  game.on("stateUpdated", e => events.push(e));

  createWebSocketMultiplayer(url)(game);
  await wait();

  const ws = MockWebSocket.instances[0];
  ws.server.sendTo(ws, JSON.stringify({ type: "chat", text: "hi" }));
  await wait();

  expect(events).toEqual([]);
  expect(game.getCurrentPlayer()).toBe(0);
});
