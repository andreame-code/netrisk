import { broadcast, loadLobby } from "../utils.js";

export async function handleChat(ctx, ws, msg) {
  const lobby = await loadLobby(ctx.lobbies, msg.code, ctx.offlinePlayerTimeout);
  if (!lobby) return;
  if (ctx.supabase) {
    ctx.supabase
      .from("lobby_chat")
      .insert({ code: lobby.code, id: msg.id, text: msg.text })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Supabase chat error", err);
      });
  }
  broadcast(lobby, {
    type: "chat",
    id: msg.id,
    text: msg.text,
  });
}
