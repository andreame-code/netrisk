import { WebSocketServer } from "ws";
import { randomBytes } from "crypto";
import fs from "fs";
import supabase from "./init/supabase-client.js";

// Load available map ids from manifest
let validMaps = [];
try {
  const manifest = JSON.parse(fs.readFileSync("map-manifest.json", "utf8"));
  validMaps = manifest.maps?.map(m => m.id) || [];
} catch {
  validMaps = [];
}

const isValidMap = id => validMaps.includes(id);

/**
 * Creates a multiplayer lobby server. The server supports creating and joining
 * lobbies, ready states, basic chat and synchronized turn based game state
 * updates. State is persisted to Supabase and cached in memory while
 * the server relays messages between clients. There is no direct
 * client-to-client communication.
 *
 * @param {object} [opts]
 * @param {number} [opts.port] Port to listen on
 * @param {number} [opts.maxPlayers] Maximum players per lobby
 * @param {number} [opts.closeEmptyLobbiesAfter] Delay in ms before closing empty lobbies
 * @param {number} [opts.offlinePlayerTimeout] Delay in ms before removing disconnected players
 * @returns {WebSocketServer} the running WebSocketServer instance
 */
export function createLobbyServer({
  port = 8081,
  maxPlayers = 6,
  closeEmptyLobbiesAfter = 5000,
  offlinePlayerTimeout = 2 * 60_000,
} = {}) {
  const wss = new WebSocketServer({ port });

  /**
   * Active lobbies keyed by lobby code
   * @type {Map<string, {code:string, players:Array, host:string, state:any, started:boolean, currentPlayer?:string, map?:string|null}>}
   */
  const lobbies = new Map();

  // Generate short lobby code
  const createCode = () => randomBytes(3).toString("hex");

  // Remove websocket instances when broadcasting lobby data
  const publicPlayers = lobby =>
    lobby.players.map(({ ws, ...p }) => {
      delete p.offlineTimer;
      return { ...p, connected: !!ws };
    });

  // Persist lobby to Supabase if available
  const persistLobby = async lobby => {
    if (!supabase) return;
    const row = {
      code: lobby.code,
      host: lobby.host,
      players: lobby.players.map(({ id, name, color, ready, lastSeen }) => ({
        id,
        name,
        color,
        ready,
        ...(lastSeen ? { lastSeen } : {}),
      })),
      started: lobby.started,
      currentPlayer: lobby.currentPlayer,
      state: lobby.state,
      map: lobby.map,
      maxPlayers: lobby.maxPlayers,
    };
    await supabase.from("lobbies").upsert(row, { onConflict: "code" }).catch(err => {
      // eslint-disable-next-line no-console
      console.error("Supabase upsert error", err);
    });
  };

  // Load lobby from cache or Supabase
  const loadLobby = async code => {
    let lobby = lobbies.get(code);
    if (!lobby && supabase) {
      const { data, error } = await supabase
        .from("lobbies")
        .select()
        .eq("code", code)
        .maybeSingle();
      if (error) {
        // eslint-disable-next-line no-console
        console.error("Supabase load error", error);
      }
      if (data) {
        lobby = {
          code: data.code,
          host: data.host,
          players: (data.players || []).map(p => ({ ...p, ws: null })),
          state: data.state || null,
          started: data.started || false,
          currentPlayer: data.currentPlayer || null,
          map: data.map || null,
          maxPlayers: data.maxPlayers || 6,
        };
        const cutoff = Date.now() - offlinePlayerTimeout;
        lobby.players = lobby.players.filter(p => !p.lastSeen || p.lastSeen > cutoff);
        lobbies.set(code, lobby);
      }
    }
    return lobby;
  };

  const broadcast = (lobby, msg) => {
    const data = JSON.stringify(msg);
    lobby.players.forEach(p => {
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(data);
      }
    });
  };

  wss.on("connection", ws => {
    let currentLobby = null;
    let currentPlayer = null;

    ws.on("message", async raw => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      switch (msg.type) {
        case "createLobby": {
          if (msg.map && !isValidMap(msg.map)) {
            ws.send(JSON.stringify({ type: "error", error: "invalidMap" }));
            break;
          }
          const code = createCode();
          const player = {
            id: msg.player?.id || createCode(),
            name: msg.player?.name,
            color: msg.player?.color,
            ready: false,
            ws,
          };
          const maxPlayers = Math.max(2, Math.min(6, msg.maxPlayers || 6));
          const lobby = {
            code,
            players: [player],
            host: player.id,
            state: null,
            started: false,
            currentPlayer: null,
            map: msg.map || null,
            maxPlayers,
          };
          lobbies.set(code, lobby);
          currentLobby = lobby;
          currentPlayer = player;
          await persistLobby(lobby);
          ws.send(
            JSON.stringify({
              type: "lobby",
              code,
              host: player.id,
              players: publicPlayers(lobby),
              map: lobby.map,
              maxPlayers: lobby.maxPlayers,
            })
          );
          break;
        }
        case "joinLobby": {
          const lobby = await loadLobby(msg.code);
          if (!lobby || lobby.started) {
            ws.send(JSON.stringify({ type: "error", error: "lobbyNotOpen" }));
            return;
          }
          if (lobby.players.length >= maxPlayers) {
            ws.send(JSON.stringify({ type: "error", error: "lobbyFull" }));
            return;
          }
          const player = {
            id: msg.player?.id || createCode(),
            name: msg.player?.name,
            color: msg.player?.color,
            ready: false,
            ws,
          };
          lobby.players.push(player);
          currentLobby = lobby;
          currentPlayer = player;
          ws.send(
            JSON.stringify({ type: "joined", code: lobby.code, id: player.id })
          );
          await persistLobby(lobby);
          broadcast(lobby, {
            type: "lobby",
            code: lobby.code,
            host: lobby.host,
            players: publicPlayers(lobby),
            map: lobby.map,
            maxPlayers: lobby.maxPlayers,
          });
          break;
        }
        case "leaveLobby": {
          const lobby = await loadLobby(msg.code);
          if (!lobby) return;
          const idx = lobby.players.findIndex(p => p.id === msg.id);
          if (idx === -1) return;
          const [player] = lobby.players.splice(idx, 1);
          if (currentPlayer === player) {
            currentPlayer = null;
            currentLobby = null;
          }
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
          });
          ws.send(JSON.stringify({ type: "left", code: lobby.code }));
          if (lobby.players.length === 0) {
            setTimeout(async () => {
              const still = lobbies.get(lobby.code);
              if (still && still.players.length === 0) {
                lobbies.delete(lobby.code);
                if (supabase) {
                  await supabase.from("lobbies").delete().eq("code", lobby.code);
                }
              }
            }, closeEmptyLobbiesAfter);
          }
          break;
        }
        case "ready": {
          const lobby = await loadLobby(msg.code);
          if (!lobby) return;
          const player = lobby.players.find(p => p.id === msg.id);
          if (!player) return;
          player.ready = !!msg.ready;
          await persistLobby(lobby);
          broadcast(lobby, {
            type: "lobby",
            code: lobby.code,
            host: lobby.host,
            players: publicPlayers(lobby),
            map: lobby.map,
            maxPlayers: lobby.maxPlayers,
          });
          break;
        }
        case "selectMap": {
          const lobby = await loadLobby(msg.code);
          if (!lobby || lobby.host !== msg.id || lobby.started) return;
          if (msg.map && !isValidMap(msg.map)) {
            ws.send(JSON.stringify({ type: "error", error: "invalidMap" }));
            return;
          }
          lobby.map = msg.map || null;
          await persistLobby(lobby);
          broadcast(lobby, {
            type: "lobby",
            code: lobby.code,
            host: lobby.host,
            players: publicPlayers(lobby),
            map: lobby.map,
            maxPlayers: lobby.maxPlayers,
          });
          break;
        }
        case "start": {
          const lobby = await loadLobby(msg.code);
          if (!lobby || lobby.host !== msg.id) return;
          if (lobby.players.length < 2) return;
          if (!lobby.players.every(p => p.ready)) return;
          lobby.state = msg.state;
          lobby.started = true;
          lobby.currentPlayer = msg.state?.currentPlayer ?? null;
          await persistLobby(lobby);
          broadcast(lobby, { type: "start", state: lobby.state, map: lobby.map });
          break;
        }
        case "state": {
          const lobby = await loadLobby(msg.code);
          if (!lobby || !lobby.started) return;
          if (lobby.state && msg.id !== lobby.state.currentPlayer) return;
          lobby.state = msg.state;
          lobby.currentPlayer = msg.state?.currentPlayer ?? null;
          await persistLobby(lobby);
          broadcast(lobby, { type: "state", state: lobby.state });
          break;
        }
        case "chat": {
          const lobby = await loadLobby(msg.code);
          if (!lobby) return;
          if (supabase) {
            supabase
              .from("lobby_chat")
              .insert({ code: lobby.code, id: msg.id, text: msg.text })
              .catch(err => {
                // eslint-disable-next-line no-console
                console.error("Supabase chat error", err);
              });
          }
          broadcast(lobby, {
            type: "chat",
            id: msg.id,
            text: msg.text,
          });
          break;
        }
        case "reconnect": {
          const lobby = await loadLobby(msg.code);
          if (!lobby) return;
          const player = lobby.players.find(p => p.id === msg.id);
          if (!player) return;
          player.ws = ws;
          player.lastSeen = null;
          if (player.offlineTimer) clearTimeout(player.offlineTimer);
          currentLobby = lobby;
          currentPlayer = player;
          await persistLobby(lobby);
          ws.send(
            JSON.stringify({
              type: "reconnected",
              code: lobby.code,
              player: {
                id: player.id,
                name: player.name,
                color: player.color,
                ready: player.ready,
              },
              state: lobby.state,
              map: lobby.map,
            })
          );
          broadcast(lobby, {
            type: "lobby",
            code: lobby.code,
            host: lobby.host,
            players: publicPlayers(lobby),
            map: lobby.map,
            maxPlayers: lobby.maxPlayers,
          });
          break;
        }
        case "heartbeat": {
          const lobby = await loadLobby(msg.code);
          if (!lobby) return;
          const player = lobby.players.find(p => p.id === msg.id);
          if (!player) return;
          player.lastSeen = Date.now();
          break;
        }
        default:
          break;
      }
    });

    ws.on("close", async () => {
      if (currentLobby && currentPlayer) {
        currentPlayer.ws = null;
        currentPlayer.ready = false;
        currentPlayer.lastSeen = Date.now();
        await persistLobby(currentLobby);
        broadcast(currentLobby, {
          type: "lobby",
          code: currentLobby.code,
          host: currentLobby.host,
          players: publicPlayers(currentLobby),
          map: currentLobby.map,
          maxPlayers: currentLobby.maxPlayers,
        });
        currentPlayer.offlineTimer = setTimeout(async () => {
          if (!currentPlayer.ws && currentLobby.players.includes(currentPlayer)) {
            const idx = currentLobby.players.indexOf(currentPlayer);
            currentLobby.players.splice(idx, 1);
            if (currentLobby.host === currentPlayer.id) {
              currentLobby.host = currentLobby.players[0]?.id || null;
            }
            await persistLobby(currentLobby);
            broadcast(currentLobby, {
              type: "lobby",
              code: currentLobby.code,
              host: currentLobby.host,
              players: publicPlayers(currentLobby),
              map: currentLobby.map,
              maxPlayers: currentLobby.maxPlayers,
            });
          }
        }, offlinePlayerTimeout);
      }
    });
  });

  return wss;
}

// If this module is executed directly, start the server immediately
if (typeof require !== "undefined" && require.main === module) {
  const port = 8081;
  createLobbyServer({ port });
  // eslint-disable-next-line no-console
  console.log(`Multiplayer server listening on port ${port}`);
}

