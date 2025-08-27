/** @jest-environment node */
import Game from "./game.js";
import { FORTIFY } from "./phases.js";
import createWebSocketMultiplayer from "./src/plugins/websocket-multiplayer-plugin.js";
import WebSocket, { WebSocketServer } from "ws";

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test("syncs game state over websocket", async () => {
  const wss = new WebSocketServer({ port: 12345 });
  wss.on("connection", ws => {
    ws.on("message", data => {
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === 1) {
          client.send(data);
        }
      });
    });
  });

  global.WebSocket = WebSocket;

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

  createWebSocketMultiplayer("ws://localhost:12345")(game1);
  createWebSocketMultiplayer("ws://localhost:12345")(game2);

  await wait(100);
  game1.setPhase(FORTIFY);
  game1.endTurn();
  await wait(100);

  expect(game2.getCurrentPlayer()).toBe(1);
  expect(events2).toEqual([{ player: 1 }]);

  wss.close();
  delete global.WebSocket;
});
