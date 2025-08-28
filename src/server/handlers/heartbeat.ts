import { loadLobby } from "../utils";

export async function handleHeartbeat(ctx: any, ws: any, msg: any) {
  const lobby = await loadLobby(ctx.lobbies, msg.code, ctx.offlinePlayerTimeout);
  if (!lobby) return;
  const player = lobby.players.find((p: any) => p.id === msg.id);
  if (!player) return;
  player.lastSeen = Date.now();
}
