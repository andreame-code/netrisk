import fs from "fs";
import { z } from "zod";
import supabase from "../init/supabase-client.js";
import { info, error } from "../logger.js";

// Load available map ids from manifest
let validMaps = [];
try {
  const manifest = JSON.parse(
    fs.readFileSync("public/assets/maps/map-manifest.json", "utf8"),
  );
  validMaps = manifest.maps?.map((m) => m.id) || [];
} catch {
  validMaps = [];
}

export const isValidMap = (id) => validMaps.includes(id);

// Remove websocket instances when broadcasting lobby data
export const publicPlayers = (lobby) =>
  lobby.players.map(
    // eslint-disable-next-line no-unused-vars
    ({ ws, offlineTimer, ...p }) => ({
      ...p,
      connected: !!ws,
    }),
  );

export const broadcast = (lobby, msg) => {
  const data = JSON.stringify(msg);
  lobby.players.forEach((p) => {
    if (p.ws && p.ws.readyState === 1) {
      p.ws.send(data);
    }
  });
};

export const persistLobby = async (lobby) => {
  if (!supabase) return;
  const row = {
    code: lobby.code,
    host: lobby.host,
    players: lobby.players.map(({ id, name, color, ready, lastSeen }) => ({
      id,
      name,
      color,
      ready,
      ...(lastSeen ? { lastSeen } : {}),
    })),
    started: lobby.started,
    current_player: lobby.currentPlayer,
    state: lobby.state,
    map: lobby.map,
    max_players: lobby.maxPlayers,
  };
  try {
    info(`Persisting lobby ${lobby.code}`);
    await supabase.from("lobbies").upsert(row, { onConflict: "code" });
    info(`Lobby ${lobby.code} persisted`);
  } catch (err) {
    error(`Supabase upsert error for lobby ${lobby.code}`, err?.message);
  }
};

export const loadLobby = async (lobbies, code, offlinePlayerTimeout) => {
  let lobby = lobbies.get(code);
  if (!lobby && supabase) {
    info(`Loading lobby ${code} from database`);
    const { data, error: loadError } = await supabase
      .from("lobbies")
      .select()
      .eq("code", code)
      .maybeSingle();
    if (loadError) {
      error(`Supabase load error for lobby ${code}`, loadError?.message);
    }
    if (data) {
      lobby = {
        code: data.code,
        host: data.host,
        players: (data.players || []).map((p) => ({ ...p, ws: null })),
        state: data.state || null,
        started: data.started || false,
        currentPlayer: data.current_player || null,
        map: data.map || null,
        maxPlayers: data.max_players || 8,
      };
      const cutoff = Date.now() - offlinePlayerTimeout;
      lobby.players = lobby.players.filter(
        (p) => !p.lastSeen || p.lastSeen > cutoff,
      );
      lobbies.set(code, lobby);
      info(`Lobby ${code} loaded from database`);
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

export const schemas = {
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

export const validateMessage = (msg) => {
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
