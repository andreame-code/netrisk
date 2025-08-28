import { WebSocketServer } from "ws";
import { randomBytes } from "crypto";
import supabase from "../init/supabase-client.js";
import {
  isValidMap,
  publicPlayers,
  broadcast,
  persistLobby,
  validateMessage,
} from "./utils";
import { handleCreateLobby } from "./handlers/createLobby";
import { handleJoinLobby } from "./handlers/joinLobby";
import { handleLeaveLobby } from "./handlers/leaveLobby";
import { handleReady } from "./handlers/ready";
import { handleSelectMap } from "./handlers/selectMap";
import { handleStart } from "./handlers/start";
import { handleState } from "./handlers/state";
import { handleChat } from "./handlers/chat";
import { handleReconnect } from "./handlers/reconnect";
import { handleHeartbeat } from "./handlers/heartbeat";

export function createLobbyServer({
  port = 8081,
  maxPlayers = 6,
  closeEmptyLobbiesAfter = 5000,
  offlinePlayerTimeout = 2 * 60_000,
}: any = {}) {
  const wss = new WebSocketServer({ port });
  const lobbies = new Map();
  const createCode = () => randomBytes(3).toString("hex");

  const ctx = {
    lobbies,
    createCode,
    maxPlayers,
    closeEmptyLobbiesAfter,
    offlinePlayerTimeout,
    isValidMap,
    supabase,
  };

  const handlers: Record<string, any> = {
    createLobby: handleCreateLobby,
    joinLobby: handleJoinLobby,
    leaveLobby: handleLeaveLobby,
    ready: handleReady,
    selectMap: handleSelectMap,
    start: handleStart,
    state: handleState,
    chat: handleChat,
    reconnect: handleReconnect,
    heartbeat: handleHeartbeat,
  };

  wss.on("connection", ws => {
    const state: any = { currentLobby: null, currentPlayer: null };

    ws.on("message", async raw => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const result = validateMessage(msg);
      if (!result.success || !("data" in result)) {
        ws.send(JSON.stringify({ type: "error", error: "invalidMessage" }));
        return;
      }
      const { data } = result;
      const handler = handlers[data.type];
      if (handler) {
        await handler(ctx, ws, data, state);
      }
    });

    ws.on("close", async () => {
      const lobby = state.currentLobby;
      const player = state.currentPlayer;
      if (lobby && player) {
        player.ws = null;
        player.ready = false;
        player.lastSeen = Date.now();
        await persistLobby(lobby);
        broadcast(lobby, {
          type: "lobby",
          code: lobby.code,
          host: lobby.host,
          players: publicPlayers(lobby),
          map: lobby.map,
          maxPlayers: lobby.maxPlayers,
        });
        player.offlineTimer = setTimeout(async () => {
          if (!player.ws && lobby.players.includes(player)) {
            const idx = lobby.players.indexOf(player);
            lobby.players.splice(idx, 1);
            if (lobby.host === player.id) {
              lobby.host = lobby.players[0]?.id || null;
            }
            await persistLobby(lobby);
            broadcast(lobby, {
              type: "lobby",
              code: lobby.code,
              host: lobby.host,
              players: publicPlayers(lobby),
              map: lobby.map,
              maxPlayers: lobby.maxPlayers,
            });
          }
        }, offlinePlayerTimeout);
      }
    });
  });

  return wss;
}

if (typeof require !== "undefined" && require.main === module) {
  const port = 8081;
  createLobbyServer({ port });
  // eslint-disable-next-line no-console
  console.log(`Multiplayer server listening on port ${port}`);
}
