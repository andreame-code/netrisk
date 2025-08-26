import { WebSocketServer } from "ws";

const port = process.env.PORT || 8081;
const wss = new WebSocketServer({ port });

wss.on("connection", ws => {
  ws.on("message", message => {
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === 1) {
        client.send(message);
      }
    });
  });
});

// eslint-disable-next-line no-console
console.log(`Multiplayer server listening on port ${port}`);
