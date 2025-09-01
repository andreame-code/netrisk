import { createAuthAdapter } from "./infra/supabase/auth.adapter.ts";
import { createLobbyAdapter } from "./infra/supabase/lobby.adapter.ts";
import { createLobbyModel } from "./features/lobby/model.js";
import { initLobby, renderLobbies } from "./features/lobby/ui.js";

const authPort = createAuthAdapter();
const lobbyPort = createLobbyAdapter();
const model = createLobbyModel({ lobbyPort, authPort });

initLobby(model);

export { initLobby, renderLobbies };
