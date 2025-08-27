// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve((req: Request) => {
  const upgrade = req.headers.get("upgrade") || "";
  const origin = req.headers.get("origin") || "*";

  const cors = {
    "Access-Control-Allow-Origin": "https://andreame-code.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("OK", { status: 200, headers: cors });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.onopen = () => socket.send(JSON.stringify({ type: "hello", ts: Date.now() }));
  socket.onmessage = (e) => socket.send(JSON.stringify({ type: "echo", data: e.data }));
  socket.onclose = () => {};
  socket.onerror = () => {};

  // aggiungi CORS alla risposta di handshake
  try { (response as any).headers?.set?.("Access-Control-Allow-Origin", cors["Access-Control-Allow-Origin"]); } catch {}
  return response;
});
