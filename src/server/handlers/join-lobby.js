import { persistLobby, publicPlayers, broadcast, loadLobby } from "../utils.js";

export async function handleJoinLobby(ctx, ws, msg, state) {
  const lobby = await loadLobby(
    ctx.lobbies,
    msg.code,
    ctx.offlinePlayerTimeout,
  );
  if (!lobby || lobby.started) {
    ws.send(JSON.stringify({ type: "error", error: "lobbyNotOpen" }));
    return;
  }
  if (lobby.players.length >= ctx.maxPlayers) {
    ws.send(JSON.stringify({ type: "error", error: "lobbyFull" }));
    return;
  }
  const player = {
    id: msg.player?.id || ctx.createCode(),
    name: msg.player?.name,
    color: msg.player?.color,
    ready: false,
    ws,
  };
  lobby.players.push(player);
  state.currentLobby = lobby;
  state.currentPlayer = player;
  ws.send(JSON.stringify({ type: "joined", code: lobby.code, id: player.id }));
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
