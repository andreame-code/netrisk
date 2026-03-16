const crypto = require("crypto");
const {
  GameAction,
  TurnPhase,
  createContinent,
  createGameState
} = require("./models.cjs");

const territories = [
  { id: "aurora", name: "Aurora", neighbors: ["bastion", "cinder", "delta"], continentId: "north" },
  { id: "bastion", name: "Bastion", neighbors: ["aurora", "ember", "forge"], continentId: "north" },
  { id: "cinder", name: "Cinder", neighbors: ["aurora", "delta", "ember"], continentId: "central" },
  { id: "delta", name: "Delta", neighbors: ["aurora", "cinder", "grove", "harbor"], continentId: "central" },
  { id: "ember", name: "Ember", neighbors: ["bastion", "cinder", "forge", "harbor"], continentId: "central" },
  { id: "forge", name: "Forge", neighbors: ["bastion", "ember", "harbor", "ion"], continentId: "east" },
  { id: "grove", name: "Grove", neighbors: ["delta", "harbor"], continentId: "south" },
  { id: "harbor", name: "Harbor", neighbors: ["delta", "ember", "forge", "grove", "ion"], continentId: "south" },
  { id: "ion", name: "Ion", neighbors: ["forge", "harbor"], continentId: "east" }
];

const continents = [
  createContinent({ id: "north", name: "North Reach", bonus: 2, territoryIds: ["aurora", "bastion"] }),
  createContinent({ id: "central", name: "Ash Corridor", bonus: 3, territoryIds: ["cinder", "delta", "ember"] }),
  createContinent({ id: "east", name: "Iron Frontier", bonus: 2, territoryIds: ["forge", "ion"] }),
  createContinent({ id: "south", name: "Harbor Belt", bonus: 2, territoryIds: ["grove", "harbor"] })
];

const palette = ["#e85d04", "#0f4c5c", "#6a994e", "#8338ec"];

function createInitialState() {
  return createGameState({
    phase: "lobby",
    turnPhase: TurnPhase.LOBBY,
    players: [],
    territories: Object.fromEntries(
      territories.map((territory) => [territory.id, { ownerId: null, armies: 0 }])
    ),
    continents,
    currentTurnIndex: 0,
    reinforcementPool: 0,
    winnerId: null,
    log: ["Lobby creata. Unisciti e avvia la partita."],
    lastAction: null
  });
}

function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

function shuffle(list, random = Math.random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = copy[i];
    copy[i] = copy[j];
    copy[j] = current;
  }
  return copy;
}

function getPlayer(state, playerId) {
  return state.players.find((player) => player.id === playerId) || null;
}

function getCurrentPlayer(state) {
  return state.players.length ? state.players[state.currentTurnIndex] : null;
}

function territoriesOwnedBy(state, playerId) {
  return territories.filter((territory) => state.territories[territory.id].ownerId === playerId);
}

function computeReinforcements(state, playerId) {
  return Math.max(3, Math.floor(territoriesOwnedBy(state, playerId).length / 3));
}

function appendLog(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 12);
}

function publicState(state) {
  const currentPlayer = getCurrentPlayer(state);
  return {
    phase: state.phase,
    turnPhase: state.turnPhase,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      connected: player.connected,
      territoryCount: territoriesOwnedBy(state, player.id).length,
      eliminated: state.phase !== "lobby" && territoriesOwnedBy(state, player.id).length === 0
    })),
    map: territories.map((territory) => ({
      id: territory.id,
      name: territory.name,
      neighbors: territory.neighbors,
      continentId: territory.continentId,
      ownerId: state.territories[territory.id].ownerId,
      armies: state.territories[territory.id].armies
    })),
    continents: state.continents,
    currentPlayerId: currentPlayer ? currentPlayer.id : null,
    reinforcementPool: state.reinforcementPool,
    winnerId: state.winnerId,
    log: state.log,
    lastAction: state.lastAction
  };
}

function startGame(state, random = Math.random) {
  const shuffledTerritories = shuffle(territories.map((territory) => territory.id), random);
  state.phase = "active";
  state.turnPhase = TurnPhase.REINFORCEMENT;
  state.winnerId = null;
  state.currentTurnIndex = 0;
  state.lastAction = null;

  shuffledTerritories.forEach((territoryId) => {
    state.territories[territoryId] = { ownerId: null, armies: 0 };
  });

  shuffledTerritories.forEach((territoryId, index) => {
    const player = state.players[index % state.players.length];
    state.territories[territoryId] = { ownerId: player.id, armies: 1 };
  });

  const firstPlayer = getCurrentPlayer(state);
  state.reinforcementPool = computeReinforcements(state, firstPlayer.id);
  appendLog(state, "Partita iniziata. Turno di " + firstPlayer.name + " con " + state.reinforcementPool + " rinforzi.");
}

function declareWinnerIfNeeded(state) {
  const activePlayers = state.players.filter((player) => territoriesOwnedBy(state, player.id).length > 0);
  if (activePlayers.length === 1) {
    state.winnerId = activePlayers[0].id;
    state.phase = "finished";
    state.turnPhase = TurnPhase.FINISHED;
    appendLog(state, activePlayers[0].name + " conquista la mappa e vince la partita.");
    return true;
  }
  return false;
}

function advanceTurn(state) {
  if (state.winnerId || declareWinnerIfNeeded(state)) {
    return;
  }

  let nextIndex = state.currentTurnIndex;
  for (let step = 0; step < state.players.length; step += 1) {
    nextIndex = (nextIndex + 1) % state.players.length;
    const candidate = state.players[nextIndex];
    if (territoriesOwnedBy(state, candidate.id).length > 0) {
      state.currentTurnIndex = nextIndex;
      state.turnPhase = TurnPhase.REINFORCEMENT;
      state.reinforcementPool = computeReinforcements(state, candidate.id);
      appendLog(state, "Nuovo turno: " + candidate.name + " riceve " + state.reinforcementPool + " rinforzi.");
      return;
    }
  }
}

function resolveAttack(state, playerId, fromId, toId, random = Math.random) {
  const attacker = getPlayer(state, playerId);
  const from = state.territories[fromId];
  const to = state.territories[toId];
  const territory = territories.find((item) => item.id === fromId);

  if (!attacker || !from || !to || !territory) {
    return { ok: false, message: "Territori non validi." };
  }

  if (state.phase !== "active") {
    return { ok: false, message: "La partita non e attiva." };
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return { ok: false, message: "Non e il tuo turno." };
  }

  if (state.reinforcementPool > 0) {
    return { ok: false, message: "Devi prima spendere tutti i rinforzi." };
  }

  state.turnPhase = TurnPhase.ATTACK;

  if (from.ownerId !== playerId || to.ownerId === playerId) {
    return { ok: false, message: "Puoi attaccare solo da un tuo territorio verso uno nemico." };
  }

  if (territory.neighbors.indexOf(toId) === -1) {
    return { ok: false, message: "I territori non sono confinanti." };
  }

  if (from.armies < 2) {
    return { ok: false, message: "Servono almeno 2 armate per attaccare." };
  }

  const attackRoll = Math.ceil(random() * 6);
  const defendRoll = Math.ceil(random() * 6);
  from.armies -= 1;
  let summary;

  if (attackRoll > defendRoll) {
    to.armies -= 1;
    summary = attacker.name + " attacca " + toId + ": " + attackRoll + " contro " + defendRoll + ".";
    if (to.armies <= 0) {
      to.ownerId = playerId;
      to.armies = 1;
      summary += " " + attacker.name + " conquista " + toId + ".";
    } else {
      summary += " Il difensore perde 1 armata.";
    }
  } else {
    summary = attacker.name + " fallisce l'attacco su " + toId + ": " + attackRoll + " contro " + defendRoll + ".";
  }

  state.lastAction = { type: GameAction.ATTACK, summary, fromId, toId };
  appendLog(state, summary);
  declareWinnerIfNeeded(state);
  return { ok: true };
}

function addPlayer(state, name) {
  const normalizedName = String(name || "").trim().slice(0, 24);
  if (!normalizedName) {
    return { ok: false, error: "Inserisci un nome." };
  }

  const existing = state.players.find((player) => player.name.toLowerCase() === normalizedName.toLowerCase());
  if (existing) {
    existing.connected = true;
    appendLog(state, existing.name + " si ricollega alla lobby.");
    return { ok: true, player: existing, rejoined: true };
  }

  if (state.phase !== "lobby") {
    return { ok: false, error: "La partita e gia iniziata." };
  }

  if (state.players.length >= 4) {
    return { ok: false, error: "La lobby e piena." };
  }

  const player = {
    id: randomId(),
    name: normalizedName,
    color: palette[state.players.length % palette.length],
    connected: true
  };
  state.players.push(player);
  appendLog(state, player.name + " entra nella lobby.");
  return { ok: true, player, rejoined: false };
}

module.exports = {
  GameAction,
  TurnPhase,
  addPlayer,
  advanceTurn,
  appendLog,
  computeReinforcements,
  continents,
  createInitialState,
  declareWinnerIfNeeded,
  getCurrentPlayer,
  getPlayer,
  palette,
  publicState,
  resolveAttack,
  startGame,
  territories,
  territoriesOwnedBy
};
