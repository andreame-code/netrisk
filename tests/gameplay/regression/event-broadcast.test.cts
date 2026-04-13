const assert = require("node:assert/strict");
const { broadcastEventPayload } = require("../../../backend/event-broadcast.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("broadcastEventPayload drops dead clients and keeps writable ones", () => {
  const deliveredPayloads: string[] = [];
  const healthyClient = {
    res: {
      destroyed: false,
      writableEnded: false,
      write(payload: string) {
        deliveredPayloads.push(payload);
      }
    },
    user: { id: "u1" }
  };
  const staleClient = {
    res: {
      destroyed: true,
      writableEnded: false,
      write() {
        throw new Error("stale client should not be written");
      }
    },
    user: { id: "u2" }
  };
  const clients = new Set([healthyClient, staleClient]);

  broadcastEventPayload(clients, (client: { user?: { id?: string } }) => `payload:${client.user?.id || "unknown"}`);

  assert.deepEqual(deliveredPayloads, ["payload:u1"]);
  assert.equal(clients.has(healthyClient), true);
  assert.equal(clients.has(staleClient), false);
});

register("broadcastEventPayload removes clients whose writes throw", () => {
  const healthyClient = {
    res: {
      destroyed: false,
      writableEnded: false,
      write() {
      }
    }
  };
  const throwingClient = {
    res: {
      destroyed: false,
      writableEnded: false,
      write() {
        throw new Error("write after end");
      }
    }
  };
  const clients = new Set([healthyClient, throwingClient]);

  broadcastEventPayload(clients, () => "payload");

  assert.equal(clients.has(healthyClient), true);
  assert.equal(clients.has(throwingClient), false);
});
