/** @jest-environment node */
import Game from '../src/game.js';
import { FORTIFY } from '../src/phases.js';
import createWebSocketMultiplayer from '../src/plugins/websocket-multiplayer-plugin.js';
import WebSocket, { WebSocketServer } from 'ws';
// eslint-disable-next-line global-require
const sampleState = require('./fixtures/game/sample-state.json');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('syncs game state over websocket', async () => {
  const wss = new WebSocketServer({ port: 12345 });
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(data);
        }
      });
    });
  });

  global.WebSocket = WebSocket;

  const { players, territories, continents, deck } = sampleState;
  const game1 = new Game(players, territories, continents, deck, false, false);
  const game2 = new Game(players, territories, continents, deck, false, false);

  const events2 = [];
  game2.on('turnStart', (e) => events2.push(e));

  createWebSocketMultiplayer('ws://localhost:12345')(game1);
  createWebSocketMultiplayer('ws://localhost:12345')(game2);

  await wait(100);
  game1.setPhase(FORTIFY);
  game1.endTurn();
  await wait(100);

  expect(game2.getCurrentPlayer()).toBe(1);
  expect(events2).toEqual([{ player: 1 }]);

  wss.close();
  delete global.WebSocket;
});
