import { createAuthAdapter } from "./infra/supabase/auth.adapter.ts";
import { createLobbyAdapter } from "./infra/supabase/lobby.adapter.ts";
import { createRealtimeAdapter } from "./infra/supabase/realtime.adapter.ts";
import { createLobbyModel } from "./features/lobby/model.js";
import { initLobby, renderLobbies } from "./features/lobby/ui.js";

const authPort = createAuthAdapter();
const lobbyPort = createLobbyAdapter();
const realtimePort = createRealtimeAdapter();
const model = createLobbyModel({ lobbyPort, authPort, realtimePort });

initLobby(model);

export { initLobby, renderLobbies };
