import { handleCreateLobby } from "../src/server/handlers/create-lobby.js";
import { handleJoinLobby } from "../src/server/handlers/join-lobby.js";
import { handleLeaveLobby } from "../src/server/handlers/leave-lobby.js";
import { handleReady } from "../src/server/handlers/ready.js";
import { handleSelectMap } from "../src/server/handlers/select-map.js";
import { handleStart } from "../src/server/handlers/start.js";
import { handleState } from "../src/server/handlers/state.js";
import { handleChat } from "../src/server/handlers/chat.js";
import { handleReconnect } from "../src/server/handlers/reconnect.js";
import { handleHeartbeat } from "../src/server/handlers/heartbeat.js";
import * as utils from "../src/server/utils.js";
// eslint-disable-next-line global-require
const baseLobby = require("./fixtures/lobby/default.json");

describe("server handlers", () => {
  test("handleCreateLobby creates lobby", async () => {
    const lobbies = new Map();
    const ctx = {
      lobbies,
      createCode: () => "abc",
      isValidMap: () => true,
    };
    const ws = { send: jest.fn(), readyState: 1 };
    const state = {};
    await handleCreateLobby(
      ctx,
      ws,
      { type: "createLobby", player: {} },
      state,
    );
    expect(lobbies.size).toBe(1);
    expect(ws.send).toHaveBeenCalled();
  });

  test("handleJoinLobby adds player", async () => {
    const lobbies = new Map();
    const lobby = { ...baseLobby, code: "code" };
    lobbies.set("code", lobby);
    const ctx = {
      lobbies,
      createCode: () => "p2",
      maxPlayers: 8,
      offlinePlayerTimeout: 0,
    };
    const ws = { send: jest.fn(), readyState: 1 };
    const state = {};
    await handleJoinLobby(
      ctx,
      ws,
      { type: "joinLobby", code: "code", player: {} },
      state,
    );
    expect(lobby.players.length).toBe(1);
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent).toEqual(
      expect.objectContaining({ type: "joined", code: "code" }),
    );
  });

  test("handleLeaveLobby removes player", async () => {
    const lobbies = new Map();
    const lobby = {
      ...baseLobby,
      code: "code",
      players: [{ id: "p1" }, { id: "p2" }],
      host: "p1",
    };
    lobbies.set("code", lobby);
    const ctx = {
      lobbies,
      closeEmptyLobbiesAfter: 0,
      offlinePlayerTimeout: 0,
      supabase: null,
    };
    const ws = { send: jest.fn() };
    await handleLeaveLobby(
      ctx,
      ws,
      { type: "leaveLobby", code: "code", id: "p2" },
      {},
    );
    expect(lobby.players.length).toBe(1);
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent).toEqual(
      expect.objectContaining({ type: "left", code: "code" }),
    );
  });

  test("handleReady toggles ready", async () => {
    const lobbies = new Map();
    const lobby = {
      ...baseLobby,
      players: [{ id: "p1", ready: false }],
      host: "p1",
    };
    lobbies.set("c", lobby);
    const ctx = { lobbies, offlinePlayerTimeout: 0 };
    await handleReady(
      ctx,
      {},
      { type: "ready", code: "c", id: "p1", ready: true },
    );
    expect(lobby.players[0].ready).toBe(true);
  });

  test("handleSelectMap updates map", async () => {
    const lobbies = new Map();
    const lobby = { ...baseLobby };
    lobbies.set("c", lobby);
    const ctx = { lobbies, offlinePlayerTimeout: 0, isValidMap: () => true };
    await handleSelectMap(
      ctx,
      {},
      { type: "selectMap", code: "c", id: "h", map: "m1" },
    );
    expect(lobby.map).toBe("m1");
  });

  test("handleStart starts game", async () => {
    const lobbies = new Map();
    const lobby = {
      ...baseLobby,
      players: [
        { id: "h", ready: true },
        { id: "p2", ready: true },
      ],
      host: "h",
    };
    lobbies.set("c", lobby);
    const ctx = { lobbies, offlinePlayerTimeout: 0 };
    await handleStart(
      ctx,
      {},
      { type: "start", code: "c", id: "h", state: { currentPlayer: "h" } },
    );
    expect(lobby.started).toBe(true);
  });

  test("handleState updates state", async () => {
    const lobbies = new Map();
    const lobby = {
      ...baseLobby,
      players: [],
      started: true,
      state: { currentPlayer: "p1" },
    };
    lobbies.set("c", lobby);
    const ctx = { lobbies, offlinePlayerTimeout: 0 };
    await handleState(
      ctx,
      {},
      {
        type: "state",
        code: "c",
        id: "p1",
        state: { foo: "bar", currentPlayer: "p1" },
      },
    );
    expect(lobby.state.foo).toBe("bar");
  });

  test("handleChat broadcasts", async () => {
    const lobbies = new Map();
    const lobby = { ...baseLobby, players: [], map: null };
    lobbies.set("c", lobby);
    const ctx = { lobbies, offlinePlayerTimeout: 0, supabase: null };
    const spy = jest.spyOn(utils, "broadcast").mockImplementation(() => {});
    await handleChat(
      ctx,
      {},
      { type: "chat", code: "c", id: "p1", text: "hi" },
    );
    expect(spy).toHaveBeenCalledWith(
      lobby,
      expect.objectContaining({ type: "chat", text: "hi" }),
    );
    spy.mockRestore();
  });

  test("handleReconnect restores player", async () => {
    const lobbies = new Map();
    const lobby = {
      ...baseLobby,
      players: [{ id: "p1", ws: null, ready: false }],
      host: "p1",
    };
    lobbies.set("c", lobby);
    const ctx = { lobbies, offlinePlayerTimeout: 0 };
    const ws = { send: jest.fn(), readyState: 1 };
    const state = {};
    await handleReconnect(
      ctx,
      ws,
      { type: "reconnect", code: "c", id: "p1" },
      state,
    );
    expect(lobby.players[0].ws).toBe(ws);
    expect(state.currentLobby).toBe(lobby);
  });

  test("handleHeartbeat updates lastSeen", async () => {
    const lobbies = new Map();
    const player = { id: "p1" };
    const lobby = { ...baseLobby, players: [player] };
    lobbies.set("c", lobby);
    const ctx = { lobbies, offlinePlayerTimeout: 0 };
    await handleHeartbeat(ctx, {}, { type: "heartbeat", code: "c", id: "p1" });
    expect(player.lastSeen).toBeDefined();
  });

  test("allows eight players to join and start", async () => {
    const lobbies = new Map();
    const lobby = {
      ...baseLobby,
      players: [],
      host: "p0",
      map: "world8",
    };
    lobbies.set("c", lobby);
    const ctx = {
      lobbies,
      createCode: () => "x",
      maxPlayers: 8,
      offlinePlayerTimeout: 0,
      isValidMap: () => true,
    };
    for (let i = 0; i < 8; i++) {
      const ws = { send: jest.fn(), readyState: 1 };
      await handleJoinLobby(
        ctx,
        ws,
        { type: "joinLobby", code: "c", player: { id: `p${i}` } },
        {},
      );
    }
    expect(lobby.players).toHaveLength(8);
    for (const p of lobby.players) {
      await handleReady(
        ctx,
        {},
        { type: "ready", code: "c", id: p.id, ready: true },
      );
    }
    await handleStart(
      ctx,
      {},
      { type: "start", code: "c", id: "p0", state: { currentPlayer: "p0" } },
    );
    expect(lobby.started).toBe(true);
  });
});
