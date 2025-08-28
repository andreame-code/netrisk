import { broadcast, persistLobby, publicPlayers, loadLobby } from "../utils.js";

export async function handleLeaveLobby(ctx, ws, msg, state) {
  const lobby = await loadLobby(ctx.lobbies, msg.code, ctx.offlinePlayerTimeout);
  if (!lobby) return;
  const idx = lobby.players.findIndex((p) => p.id === msg.id);
  if (idx === -1) return;
  const [player] = lobby.players.splice(idx, 1);
  if (state.currentPlayer === player) {
    state.currentPlayer = null;
    state.currentLobby = null;
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
      const still = ctx.lobbies.get(lobby.code);
      if (still && still.players.length === 0) {
        ctx.lobbies.delete(lobby.code);
        if (ctx.supabase) {
          await ctx.supabase.from("lobbies").delete().eq("code", lobby.code);
        }
      }
    }, ctx.closeEmptyLobbiesAfter);
  }
}
