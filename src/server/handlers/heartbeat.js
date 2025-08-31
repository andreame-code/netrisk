import { loadLobby } from "../utils.js";

export async function handleHeartbeat(ctx, ws, msg) {
  const lobby = await loadLobby(
    ctx.lobbies,
    msg.code,
    ctx.offlinePlayerTimeout,
  );
  if (!lobby) return;
  const player = lobby.players.find((p) => p.id === msg.id);
  if (!player) return;
  player.lastSeen = Date.now();
}
