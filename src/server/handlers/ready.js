import { broadcast, persistLobby, publicPlayers, loadLobby } from "../utils.js";

export async function handleReady(ctx, ws, msg) {
  const lobby = await loadLobby(
    ctx.lobbies,
    msg.code,
    ctx.offlinePlayerTimeout,
  );
  if (!lobby) return;
  const player = lobby.players.find((p) => p.id === msg.id);
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
}
