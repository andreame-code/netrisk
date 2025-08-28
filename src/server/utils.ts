import fs from "fs";
import { z } from "zod";
import supabase from "../init/supabase-client.js";

// Load available map ids from manifest
let validMaps: string[] = [];
try {
  const manifest = JSON.parse(fs.readFileSync("map-manifest.json", "utf8"));
  validMaps = manifest.maps?.map((m: any) => m.id) || [];
} catch {
  validMaps = [];
}

export const isValidMap = (id: string) => validMaps.includes(id);

// Remove websocket instances when broadcasting lobby data
export const publicPlayers = (lobby: any) =>
  lobby.players.map(({ ws, offlineTimer, ...p }: any) => ({
    ...p,
    connected: !!ws,
  }));

export const broadcast = (lobby: any, msg: any) => {
  const data = JSON.stringify(msg);
  lobby.players.forEach((p: any) => {
    if (p.ws && p.ws.readyState === 1) {
      p.ws.send(data);
    }
  });
};

export const persistLobby = async (lobby: any) => {
  if (!supabase) return;
  const row = {
    code: lobby.code,
    host: lobby.host,
    players: lobby.players.map(({ id, name, color, ready, lastSeen }: any) => ({
      id,
      name,
      color,
      ready,
      ...(lastSeen ? { lastSeen } : {}),
    })),
    started: lobby.started,
    currentPlayer: lobby.currentPlayer,
    state: lobby.state,
    map: lobby.map,
    maxPlayers: lobby.maxPlayers,
  };
  try {
    await supabase.from("lobbies").upsert(row, { onConflict: "code" });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Supabase upsert error", err);
  }
};

export const loadLobby = async (
  lobbies: Map<string, any>,
  code: string,
  offlinePlayerTimeout: number,
) => {
  let lobby = lobbies.get(code);
  if (!lobby && supabase) {
    const { data, error } = await supabase
      .from("lobbies")
      .select()
      .eq("code", code)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Supabase load error", error);
    }
    if (data) {
      lobby = {
        code: data.code,
        host: data.host,
        players: (data.players || []).map((p: any) => ({ ...p, ws: null })),
        state: data.state || null,
        started: data.started || false,
        currentPlayer: data.currentPlayer || null,
        map: data.map || null,
        maxPlayers: data.maxPlayers || 6,
      };
      const cutoff = Date.now() - offlinePlayerTimeout;
      lobby.players = lobby.players.filter(
        (p: any) => !p.lastSeen || p.lastSeen > cutoff,
      );
      lobbies.set(code, lobby);
    }
  }
  return lobby;
};

// Schemas for incoming messages
const playerSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    color: z.string().optional(),
  })
  .optional();

const codeSchema = z.string();
const idSchema = z.string();

export const createLobbySchema = z.object({
  type: z.literal("createLobby"),
  player: playerSchema,
  map: z.string().optional(),
  maxPlayers: z.number().optional(),
});

export const joinLobbySchema = z.object({
  type: z.literal("joinLobby"),
  code: codeSchema,
  player: playerSchema,
});

export const leaveLobbySchema = z.object({
  type: z.literal("leaveLobby"),
  code: codeSchema,
  id: idSchema,
});

export const readySchema = z.object({
  type: z.literal("ready"),
  code: codeSchema,
  id: idSchema,
  ready: z.boolean(),
});

export const selectMapSchema = z.object({
  type: z.literal("selectMap"),
  code: codeSchema,
  id: idSchema,
  map: z.string().nullable().optional(),
});

export const startSchema = z.object({
  type: z.literal("start"),
  code: codeSchema,
  id: idSchema,
  state: z.any(),
});

export const stateSchema = z.object({
  type: z.literal("state"),
  code: codeSchema,
  id: idSchema,
  state: z.any(),
});

export const chatSchema = z.object({
  type: z.literal("chat"),
  code: codeSchema,
  id: idSchema,
  text: z.string(),
});

export const reconnectSchema = z.object({
  type: z.literal("reconnect"),
  code: codeSchema,
  id: idSchema,
});

export const heartbeatSchema = z.object({
  type: z.literal("heartbeat"),
  code: codeSchema,
  id: idSchema,
});

export const schemas: Record<string, z.ZodTypeAny> = {
  createLobby: createLobbySchema,
  joinLobby: joinLobbySchema,
  leaveLobby: leaveLobbySchema,
  ready: readySchema,
  selectMap: selectMapSchema,
  start: startSchema,
  state: stateSchema,
  chat: chatSchema,
  reconnect: reconnectSchema,
  heartbeat: heartbeatSchema,
};

export const validateMessage = (msg: any) => {
  const schema = schemas[msg?.type];
  if (!schema) return { success: false, error: "unknownType" };
  return schema.safeParse(msg);
};

export default {
  isValidMap,
  publicPlayers,
  broadcast,
  persistLobby,
  loadLobby,
  validateMessage,
  schemas,
};
