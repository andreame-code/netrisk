import { broadcast, persistLobby, loadLobby } from "../utils.js";

export async function handleStart(ctx, ws, msg) {
  const lobby = await loadLobby(
    ctx.lobbies,
    msg.code,
    ctx.offlinePlayerTimeout,
  );
  if (!lobby || lobby.host !== msg.id) return;
  if (lobby.players.length < 2) return;
  if (!lobby.players.every((p) => p.ready)) return;
  lobby.state = msg.state;
  lobby.started = true;
  lobby.currentPlayer = msg.state?.currentPlayer ?? null;
  await persistLobby(lobby);
  broadcast(lobby, { type: "start", state: lobby.state, map: lobby.map });
}
