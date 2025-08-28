import { broadcast, persistLobby, loadLobby } from "../utils.js";

export async function handleState(ctx, ws, msg) {
  const lobby = await loadLobby(ctx.lobbies, msg.code, ctx.offlinePlayerTimeout);
  if (!lobby || !lobby.started) return;
  if (lobby.state && msg.id !== lobby.state.currentPlayer) return;
  lobby.state = msg.state;
  lobby.currentPlayer = msg.state?.currentPlayer ?? null;
  await persistLobby(lobby);
  broadcast(lobby, { type: "state", state: lobby.state });
}
