const { userRole } = require("./auth.cjs");

const Roles = {
  USER: "user",
  ADMIN: "admin"
};

function actorForUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: userRole(user)
  };
}

function canCreateGame(actor) {
  return Boolean(actor && actor.id && (actor.role === Roles.USER || actor.role === Roles.ADMIN));
}

function canOpenGame(actor, game, state) {
  if (!actor || !actor.id || !game) {
    return false;
  }

  if (actor.role === Roles.ADMIN) {
    return true;
  }

  if (state && state.phase === "lobby") {
    return true;
  }

  if (game.creatorUserId && game.creatorUserId === actor.id) {
    return true;
  }

  const players = Array.isArray(state && state.players) ? state.players : [];
  if (players.some((player) => player && player.name === actor.username)) {
    return true;
  }

  return !game.creatorUserId;
}

function canStartGame(actor, game) {
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

function authorize(action, context = {}) {
  const actor = actorForUser(context.user);

  if (action === "game:create") {
    if (!actor) {
      const error = new Error("Sessione non valida.");
      error.statusCode = 401;
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    if (!canCreateGame(actor)) {
      const error = new Error("Non hai i permessi per creare una partita.");
      error.statusCode = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    return { ok: true, actor };
  }

  if (action === "game:open" || action === "game:read") {
    if (!actor) {
      const error = new Error("Sessione non valida.");
      error.statusCode = 401;
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    if (!canOpenGame(actor, context.game, context.state)) {
      const error = new Error("Puoi aprire solo partite di cui fai parte.");
      error.statusCode = 403;
      error.code = "MEMBER_ONLY";
      throw error;
    }

    return { ok: true, actor };
  }

  if (action === "game:start") {
    if (!actor) {
      const error = new Error("Sessione non valida.");
      error.statusCode = 401;
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    if (!canStartGame(actor, context.game)) {
      const error = new Error("Solo il creatore della partita puo avviarla.");
      error.statusCode = 403;
      error.code = "HOST_ONLY";
      throw error;
    }

    return { ok: true, actor };
  }

  const error = new Error("Policy non supportata: " + action);
  error.statusCode = 500;
  error.code = "POLICY_NOT_IMPLEMENTED";
  throw error;
}

module.exports = {
  Roles,
  actorForUser,
  authorize,
  canCreateGame,
  canOpenGame,
  canStartGame
};
