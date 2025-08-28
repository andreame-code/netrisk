import { broadcast, persistLobby, publicPlayers, loadLobby } from "../utils";

export async function handleReconnect(ctx: any, ws: any, msg: any, state: any) {
  const lobby = await loadLobby(ctx.lobbies, msg.code, ctx.offlinePlayerTimeout);
  if (!lobby) return;
  const player = lobby.players.find((p: any) => p.id === msg.id);
  if (!player) return;
  player.ws = ws;
  player.lastSeen = null;
  if (player.offlineTimer) clearTimeout(player.offlineTimer);
  state.currentLobby = lobby;
  state.currentPlayer = player;
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
    }),
  );
  broadcast(lobby, {
    type: "lobby",
    code: lobby.code,
    host: lobby.host,
    players: publicPlayers(lobby),
    map: lobby.map,
    maxPlayers: lobby.maxPlayers,
  });
}
