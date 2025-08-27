import { WebSocketServer } from "ws";
import { randomBytes } from "crypto";
import supabase from "./src/init/supabase-client.js";

/**
 * Creates a multiplayer lobby server. The server supports creating and joining
 * lobbies, ready states, basic chat and synchronized turn based game state
 * updates. All state is kept in memory and broadcast to connected clients
 * through WebSocket messages.
 *
 * @param {object} [opts]
 * @param {number} [opts.port] Port to listen on
 * @returns {WebSocketServer} the running WebSocketServer instance
 */
export function createLobbyServer({ port = process.env.PORT || 8081 } = {}) {
  const wss = new WebSocketServer({ port });

  /**
   * Active lobbies keyed by lobby code
   * @type {Map<string, {code:string, players:Array, host:string, state:any, started:boolean, currentPlayer?:string}>}
   */
  const lobbies = new Map();

  // Generate short lobby code
  const createCode = () => randomBytes(3).toString("hex");

  // Remove websocket instances when broadcasting lobby data
  const publicPlayers = lobby =>
    lobby.players.map(({ ws, ...p }) => ({ ...p, connected: !!ws }));

  const broadcast = (lobby, msg, except) => {
    const data = JSON.stringify(msg);
    lobby.players.forEach(p => {
      if (p.ws && p.ws.readyState === 1 && p.ws !== except) {
        p.ws.send(data);
      }
    });
  };

  wss.on("connection", ws => {
    let currentLobby = null;
    let currentPlayer = null;

    ws.on("message", raw => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      switch (msg.type) {
        case "createLobby": {
          const code = createCode();
          const player = {
            id: msg.player?.id || createCode(),
            name: msg.player?.name,
            color: msg.player?.color,
            ready: false,
            ws,
          };
          const lobby = {
            code,
            players: [player],
            host: player.id,
            state: null,
            started: false,
            currentPlayer: null,
          };
          lobbies.set(code, lobby);
          currentLobby = lobby;
          currentPlayer = player;
          if (supabase) {
            supabase
              .from("lobbies")
              .insert({ code, host: player.id })
              .catch(err => {
                // eslint-disable-next-line no-console
                console.error("Supabase insert error", err);
              });
          }
          ws.send(
            JSON.stringify({
              type: "lobby",
              code,
              host: player.id,
              players: publicPlayers(lobby),
            })
          );
          break;
        }
        case "joinLobby": {
          const lobby = lobbies.get(msg.code);
          if (!lobby || lobby.started) {
            ws.send(JSON.stringify({ type: "error", error: "lobbyNotFound" }));
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
          broadcast(lobby, {
            type: "lobby",
            code: lobby.code,
            host: lobby.host,
            players: publicPlayers(lobby),
          });
          break;
        }
        case "ready": {
          const lobby = lobbies.get(msg.code);
          if (!lobby) return;
          const player = lobby.players.find(p => p.id === msg.id);
          if (!player) return;
          player.ready = !!msg.ready;
          broadcast(lobby, {
            type: "lobby",
            code: lobby.code,
            host: lobby.host,
            players: publicPlayers(lobby),
          });
          break;
        }
        case "start": {
          const lobby = lobbies.get(msg.code);
          if (!lobby || lobby.host !== msg.id) return;
          if (!lobby.players.every(p => p.ready)) return;
          lobby.state = msg.state;
          lobby.started = true;
          lobby.currentPlayer = msg.state?.currentPlayer ?? null;
          broadcast(lobby, { type: "start", state: lobby.state });
          break;
        }
        case "state": {
          const lobby = lobbies.get(msg.code);
          if (!lobby || !lobby.started) return;
          if (lobby.state && msg.id !== lobby.state.currentPlayer) return;
          lobby.state = msg.state;
          lobby.currentPlayer = msg.state?.currentPlayer ?? null;
          broadcast(lobby, { type: "state", state: lobby.state }, ws);
          break;
        }
        case "chat": {
          const lobby = lobbies.get(msg.code);
          if (!lobby) return;
          broadcast(lobby, {
            type: "chat",
            id: msg.id,
            text: msg.text,
          });
          break;
        }
        case "reconnect": {
          const lobby = lobbies.get(msg.code);
          if (!lobby) return;
          const player = lobby.players.find(p => p.id === msg.id);
          if (!player) return;
          player.ws = ws;
          currentLobby = lobby;
          currentPlayer = player;
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
            })
          );
          break;
        }
        default:
          break;
      }
    });

    ws.on("close", () => {
      if (currentLobby && currentPlayer) {
        currentPlayer.ws = null;
        currentPlayer.ready = false;
        broadcast(currentLobby, {
          type: "lobby",
          code: currentLobby.code,
          host: currentLobby.host,
          players: publicPlayers(currentLobby),
        });
      }
    });
  });

  return wss;
}

// If this module is executed directly, start the server immediately
if (typeof require !== "undefined" && require.main === module) {
  const port = process.env.PORT || 8081;
  createLobbyServer({ port });
  // eslint-disable-next-line no-console
  console.log(`Multiplayer server listening on port ${port}`);
}

