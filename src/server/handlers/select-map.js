import { broadcast, persistLobby, publicPlayers, loadLobby } from '../utils.js';

export async function handleSelectMap(ctx, ws, msg) {
  const lobby = await loadLobby(ctx.lobbies, msg.code, ctx.offlinePlayerTimeout);
  if (!lobby || lobby.host !== msg.id || lobby.started) return;
  if (msg.map && !ctx.isValidMap(msg.map)) {
    ws.send(JSON.stringify({ type: 'error', error: 'invalidMap' }));
    return;
  }
  lobby.map = msg.map || null;
  await persistLobby(lobby);
  broadcast(lobby, {
    type: 'lobby',
    code: lobby.code,
    host: lobby.host,
    players: publicPlayers(lobby),
    map: lobby.map,
    maxPlayers: lobby.maxPlayers,
  });
}
