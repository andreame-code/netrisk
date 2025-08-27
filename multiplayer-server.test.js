/** @jest-environment node */
import WebSocket from "ws";
jest.mock("./src/init/supabase-client.js", () => null);
const { createLobbyServer } = require("./multiplayer-server.js");

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

test("lobby server manages lifecycle", async () => {
  const port = 12346;
  const server = createLobbyServer({ port });
  const url = `ws://localhost:${port}`;

  const ws1 = new WebSocket(url);
  await onceOpen(ws1);
  const q1 = messageQueue(ws1);
  ws1.send(
    JSON.stringify({
      type: "createLobby",
      player: { id: "p1", name: "P1", color: "#f00" },
    })
  );
  await wait(50);
  const lobbyMsg = q1.shift();
  const code = lobbyMsg.code;

  const ws2 = new WebSocket(url);
  await onceOpen(ws2);
  const q2 = messageQueue(ws2);
  ws2.send(
    JSON.stringify({
      type: "joinLobby",
      code,
      player: { id: "p2", name: "P2", color: "#0f0" },
    })
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
      type: "joinLobby",
      code,
      player: { id: "p3", name: "P3", color: "#00f" },
    })
  );
  await wait(50);
  q3.shift();
  q1.shift();
  q2.shift();
  q3.shift();

  ws1.send(
    JSON.stringify({ type: "selectMap", code, id: "p1", map: "test" })
  );
  await wait(50);
  const map1 = q1.shift();
  const map2 = q2.shift();
  const map3 = q3.shift();
  expect(map1.map).toBe("test");
  expect(map2.map).toBe("test");
  expect(map3.map).toBe("test");

  ws1.send(JSON.stringify({ type: "ready", code, id: "p1", ready: true }));
  ws2.send(JSON.stringify({ type: "ready", code, id: "p2", ready: true }));
  ws3.send(JSON.stringify({ type: "ready", code, id: "p3", ready: true }));
  await wait(50);
  q1.splice(0); q2.splice(0); q3.splice(0);

  ws1.send(
    JSON.stringify({
      type: "start",
      code,
      id: "p1",
      state: { currentPlayer: "p1" },
    })
  );
  await wait(50);
  const start2 = q2.shift();
  const start3 = q3.shift();
  const start1 = q1.shift();
  expect(start2.type).toBe("start");
  expect(start3.state.currentPlayer).toBe("p1");
  expect(start1.type).toBe("start");

  ws1.send(
    JSON.stringify({
      type: "state",
      code,
      id: "p1",
      state: { currentPlayer: "p2" },
    })
  );
  await wait(50);
  const stateMsg = q2.shift();
  expect(stateMsg.state.currentPlayer).toBe("p2");

  q1.shift(); // clear host state broadcast

  ws2.send(JSON.stringify({ type: "chat", code, id: "p2", text: "hi" }));
  await wait(50);
  const chatMsg = q1.shift();
  expect(chatMsg.type).toBe("chat");
  expect(chatMsg.text).toBe("hi");

  ws3.close();
  await onceClose(ws3);
  const ws3b = new WebSocket(url);
  await onceOpen(ws3b);
  const q3b = messageQueue(ws3b);
  ws3b.send(JSON.stringify({ type: "reconnect", code, id: "p3" }));
  await wait(50);
  const rec = q3b.shift();
  expect(rec.type).toBe("reconnected");
  expect(rec.state.currentPlayer).toBe("p2");

  ws1.close();
  ws2.close();
  ws3b.close();
  server.close();
});

