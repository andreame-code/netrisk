const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { server } = require("../src/server.cjs");

let listener;
let baseUrl;

test.before(async () => {
  listener = server.listen(0);
  await once(listener, "listening");
  const address = listener.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (listener) {
    await new Promise((resolve, reject) => {
      listener.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("GET /api/state risponde con lo stato pubblico", async () => {
  const response = await fetch(`${baseUrl}/api/state`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.phase, "lobby");
  assert.ok(Array.isArray(payload.map));
});

test("join + start + reinforce flusso base API", async () => {
  const joinAlice = await fetch(`${baseUrl}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "ApiAlice" })
  });
  assert.equal(joinAlice.status, 201);
  const aliceData = await joinAlice.json();

  const joinBob = await fetch(`${baseUrl}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "ApiBob" })
  });
  assert.equal(joinBob.status, 201);

  const start = await fetch(`${baseUrl}/api/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: aliceData.playerId })
  });
  assert.equal(start.status, 200);
  const started = await start.json();
  assert.equal(started.state.phase, "active");

  const mine = started.state.map.find((territory) => territory.ownerId === aliceData.playerId);
  assert.ok(mine);

  const reinforce = await fetch(`${baseUrl}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId: aliceData.playerId,
      type: "reinforce",
      territoryId: mine.id
    })
  });
  assert.equal(reinforce.status, 200);
  const reinforced = await reinforce.json();
  const updated = reinforced.state.map.find((territory) => territory.id === mine.id);
  assert.equal(updated.armies >= mine.armies + 1, true);
});
