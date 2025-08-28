import { broadcast, persistLobby, loadLobby } from "../utils";

export async function handleStart(ctx: any, ws: any, msg: any) {
  const lobby = await loadLobby(ctx.lobbies, msg.code, ctx.offlinePlayerTimeout);
  if (!lobby || lobby.host !== msg.id) return;
  if (lobby.players.length < 2) return;
  if (!lobby.players.every((p: any) => p.ready)) return;
  lobby.state = msg.state;
  lobby.started = true;
  lobby.currentPlayer = msg.state?.currentPlayer ?? null;
  await persistLobby(lobby);
  broadcast(lobby, { type: "start", state: lobby.state, map: lobby.map });
}
