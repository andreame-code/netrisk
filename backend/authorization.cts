const { userRole } = require("./auth.cjs");

const Roles = {
  USER: "user",
  ADMIN: "admin"
};

interface Actor {
  id: string;
  username: string;
  role: string;
}

interface UserLike {
  id: string;
  username: string;
  role?: string;
}

interface PlayerLike {
  linkedUserId?: string | null;
  name?: string | null;
}

interface GameLike {
  phase?: string | null;
  creatorUserId?: string | null;
}

interface AuthorizationContext {
  user?: UserLike | null;
  game?: GameLike | null;
  state?: { players?: PlayerLike[] | null } | null;
}

type AuthorizationError = Error & {
  statusCode: number;
  code: string;
};

function createAuthorizationError(message: string, statusCode: number, code: string): AuthorizationError {
  const error = new Error(message) as AuthorizationError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function actorForUser(user: UserLike | null | undefined): Actor | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: userRole(user)
  };
}

function canCreateGame(actor: Actor | null): boolean {
  return Boolean(actor && actor.id && (actor.role === Roles.USER || actor.role === Roles.ADMIN));
}

function isActorPlayer(player: PlayerLike | null | undefined, actor: Actor) {
  if (!player) return false;
  if (player.linkedUserId) return player.linkedUserId === actor.id;
  return player.name === actor.username;
}

function canOpenGame(actor: Actor | null, game: GameLike | null | undefined, state: AuthorizationContext["state"]): boolean {
  if (!actor || !actor.id || !game) {
    return false;
  }

  if (actor.role === Roles.ADMIN) {
    return true;
  }

  if (game.phase === "lobby") {
    return true;
  }

  if (game.creatorUserId && game.creatorUserId === actor.id) {
    return true;
  }

  const players = Array.isArray(state?.players) ? state.players : [];
  if (players.some((player) => isActorPlayer(player, actor))) {
    return true;
  }

  return !game.creatorUserId;
}

function canReadGame(actor: Actor | null, game: GameLike | null | undefined, state: AuthorizationContext["state"]): boolean {
  if (!actor || !actor.id || !game) {
    return false;
  }

  if (actor.role === Roles.ADMIN) {
    return true;
  }

  if (game.phase === "lobby") {
    return true;
  }

  if (game.creatorUserId && game.creatorUserId === actor.id) {
    return true;
  }

  const players = Array.isArray(state?.players) ? state.players : [];
  if (players.some((player) => isActorPlayer(player, actor))) {
    return true;
  }

  return !game.creatorUserId;
}

function canStartGame(actor: Actor | null, game: GameLike | null | undefined): boolean {
  if (!actor || !actor.id || !game) {
    return false;
  }

  if (actor.role === Roles.ADMIN) {
    return true;
  }

  if (!game.creatorUserId) {
    return true;
  }

  return game.creatorUserId === actor.id;
}

function canManageModules(actor: Actor | null): boolean {
  return Boolean(actor && actor.id && actor.role === Roles.ADMIN);
}

function authorize(action: string, context: AuthorizationContext = {}) {
  const actor = actorForUser(context.user);

  if (action === "game:create") {
    if (!actor) {
      throw createAuthorizationError("Sessione non valida.", 401, "AUTH_REQUIRED");
    }

    if (!canCreateGame(actor)) {
      throw createAuthorizationError("Non hai i permessi per creare una partita.", 403, "FORBIDDEN");
    }

    return { ok: true, actor };
  }

  if (action === "game:open" || action === "game:read") {
    if (!actor) {
      throw createAuthorizationError("Sessione non valida.", 401, "AUTH_REQUIRED");
    }

    const allowed = action === "game:read"
      ? canReadGame(actor, context.game, context.state)
      : canOpenGame(actor, context.game, context.state);

    if (!allowed) {
      throw createAuthorizationError("Puoi aprire solo partite di cui fai parte.", 403, "MEMBER_ONLY");
    }

    return { ok: true, actor };
  }

  if (action === "game:start") {
    if (!actor) {
      throw createAuthorizationError("Sessione non valida.", 401, "AUTH_REQUIRED");
    }

    if (!canStartGame(actor, context.game)) {
      throw createAuthorizationError("Solo il creatore della partita puo avviarla.", 403, "HOST_ONLY");
    }

    return { ok: true, actor };
  }

  if (action === "modules:manage") {
    if (!actor) {
      throw createAuthorizationError("Sessione non valida.", 401, "AUTH_REQUIRED");
    }

    if (!canManageModules(actor)) {
      throw createAuthorizationError("Solo gli admin possono gestire i moduli.", 403, "ADMIN_ONLY");
    }

    return { ok: true, actor };
  }

  throw createAuthorizationError("Policy non supportata: " + action, 500, "POLICY_NOT_IMPLEMENTED");
}

module.exports = {
  Roles,
  actorForUser,
  authorize,
  canReadGame,
  canCreateGame,
  canManageModules,
  canOpenGame,
  canStartGame
};
