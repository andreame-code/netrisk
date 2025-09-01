import { createAuthAdapter } from "./infra/supabase/auth.adapter.ts";
import { createLobbyAdapter } from "./infra/supabase/lobby.adapter.ts";
import { createRealtimeAdapter } from "./infra/supabase/realtime.adapter.ts";
import { createLobbyModel } from "./features/lobby/model.js";
import { initLobby, renderLobbies } from "./features/lobby/ui.js";
import { error } from "./logger.js";

const authPort = createAuthAdapter();
const lobbyPort = createLobbyAdapter();

let realtimePort = null;
try {
  realtimePort = createRealtimeAdapter();
} catch {
  error("Supabase client not configured; realtime features disabled");
}

const model = createLobbyModel({ lobbyPort, authPort, realtimePort });

initLobby(model);

export { initLobby, renderLobbies };
