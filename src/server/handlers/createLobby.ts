import { persistLobby, publicPlayers } from "../utils";

export async function handleCreateLobby(ctx: any, ws: any, msg: any, state: any) {
  if (msg.map && !ctx.isValidMap(msg.map)) {
    ws.send(JSON.stringify({ type: "error", error: "invalidMap" }));
    return;
  }
  const code = ctx.createCode();
  const player = {
    id: msg.player?.id || ctx.createCode(),
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
  ctx.lobbies.set(code, lobby);
  state.currentLobby = lobby;
  state.currentPlayer = player;
  await persistLobby(lobby);
  ws.send(
    JSON.stringify({
      type: "lobby",
      code,
      host: player.id,
      players: publicPlayers(lobby),
      map: lobby.map,
      maxPlayers: lobby.maxPlayers,
    }),
  );
}
