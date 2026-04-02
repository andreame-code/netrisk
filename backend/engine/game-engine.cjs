const crypto = require("crypto");
const {
  GameAction,
  TurnPhase,
  createContinent,
  createGameState,
  createPlayer,
  createStandardDeck,
  getCardRuleSet,
  getDiceRuleSet,
  standardTradeBonusForIndex,
  validateStandardCardSet
} = require("../../shared/models.cjs");
const { detectVictory } = require("./victory-detection.cjs");
const { compareCombatDice, rollCombatDice } = require("./combat-dice.cjs");

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
    lastAction: null,
    pendingConquest: null,
    fortifyUsed: false,
    cardRuleSetId: "standard",
    deck: createStandardDeck(territories.map((territory) => territory.id)),
    discardPile: [],
    hands: {},
    tradeCount: 0,
    conqueredTerritoryThisTurn: false
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

function ensurePlayerHand(state, playerId) {
  if (!Array.isArray(state.hands[playerId])) {
    state.hands[playerId] = [];
  }
  return state.hands[playerId];
}

function getForcedTradeLimit(state) {
  return getCardRuleSet(state.cardRuleSetId || "standard").maxHandBeforeForcedTrade || 5;
}

function playerMustTradeCards(state, playerId) {
  return ensurePlayerHand(state, playerId).length > getForcedTradeLimit(state);
}

function refillDeckFromDiscardIfNeeded(state, random = Math.random) {
  if (!Array.isArray(state.deck)) {
    state.deck = [];
  }

  if (state.deck.length > 0) {
    return false;
  }

  if (!Array.isArray(state.discardPile) || state.discardPile.length === 0) {
    return false;
  }

  state.deck = shuffle(state.discardPile, random);
  state.discardPile = [];
  return true;
}

function awardTurnCardIfEligible(state, playerId, random = Math.random) {
  if (!state.conqueredTerritoryThisTurn) {
    return null;
  }

  const player = getPlayer(state, playerId);
  if (!player) {
    return null;
  }

  refillDeckFromDiscardIfNeeded(state, random);
  if (!Array.isArray(state.deck) || state.deck.length === 0) {
    return null;
  }

  const nextCard = state.deck.shift();
  ensurePlayerHand(state, playerId).push(nextCard);
  state.conqueredTerritoryThisTurn = false;
  appendLog(state, player.name + " riceve una carta territorio.");
  return nextCard;
}

function tradeCardSet(state, playerId, cardIds) {
  const player = getPlayer(state, playerId);
  if (!player) {
    return { ok: false, message: "Giocatore non valido." };
  }

  if (state.phase !== "active") {
    return { ok: false, message: "La partita non e attiva." };
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return { ok: false, message: "Non e il tuo turno." };
  }

  if (state.turnPhase !== TurnPhase.REINFORCEMENT) {
    return { ok: false, message: "Puoi scambiare carte solo nella fase di rinforzo." };
  }

  if (!Array.isArray(cardIds) || cardIds.length !== 3) {
    return { ok: false, message: "Devi selezionare esattamente 3 carte." };
  }

  const uniqueCardIds = [...new Set(cardIds)];
  if (uniqueCardIds.length !== 3) {
    return { ok: false, message: "Non puoi usare la stessa carta due volte." };
  }

  const hand = ensurePlayerHand(state, playerId);
  const selectedCards = uniqueCardIds.map((cardId) => hand.find((card) => card.id === cardId));
  if (selectedCards.some((card) => !card)) {
    return { ok: false, message: "Le carte selezionate non sono disponibili nella mano del giocatore." };
  }

  const validation = validateStandardCardSet(selectedCards);
  if (!validation.ok) {
    return { ok: false, message: validation.reason };
  }

  const bonus = standardTradeBonusForIndex(state.tradeCount || 0);
  state.hands[playerId] = hand.filter((card) => !uniqueCardIds.includes(card.id));
  if (!Array.isArray(state.discardPile)) {
    state.discardPile = [];
  }
  state.discardPile.push(...selectedCards);
  state.tradeCount = (state.tradeCount || 0) + 1;
  state.reinforcementPool += bonus;
  state.lastAction = {
    type: "tradeCards",
    summary: player.name + " scambia un set di carte e riceve " + bonus + " rinforzi."
  };
  appendLog(state, player.name + " scambia un set di carte e riceve " + bonus + " rinforzi.");
  return { ok: true, bonus, validation };
}

function readableMapName(mapId) {
  if (mapId === "classic-mini") {
    return "Classic Mini";
  }
  return mapId || null;
}

function publicState(state) {
  const currentPlayer = getCurrentPlayer(state);
  const diceRuleSet = getDiceRuleSet(state.diceRuleSetId || "standard");
  return {
    phase: state.phase,
    turnPhase: state.turnPhase,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      connected: player.connected,
      isAi: Boolean(player.isAi),
      territoryCount: territoriesOwnedBy(state, player.id).length,
      eliminated: state.phase !== "lobby" && territoriesOwnedBy(state, player.id).length === 0,
      cardCount: Array.isArray(state.hands?.[player.id]) ? state.hands[player.id].length : 0
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
    gameConfig: state.gameConfig
      ? {
          ...state.gameConfig,
          mapName: state.gameConfig.mapName || readableMapName(state.gameConfig.mapId)
        }
      : null,
    log: state.log,
    lastAction: state.lastAction,
    lastCombat: state.lastAction && state.lastAction.type === GameAction.ATTACK ? state.lastAction.combat || null : null,
    diceRuleSet: {
      id: diceRuleSet.id || "standard",
      attackerMaxDice: diceRuleSet.attackerMaxDice,
      defenderMaxDice: diceRuleSet.defenderMaxDice
    },
    pendingConquest: state.pendingConquest,
    fortifyUsed: Boolean(state.fortifyUsed),
    conqueredTerritoryThisTurn: Boolean(state.conqueredTerritoryThisTurn),
    cardState: {
      ruleSetId: state.cardRuleSetId || "standard",
      tradeCount: Number.isInteger(state.tradeCount) ? state.tradeCount : 0,
      deckCount: Array.isArray(state.deck) ? state.deck.length : 0,
      discardCount: Array.isArray(state.discardPile) ? state.discardPile.length : 0,
      nextTradeBonus: getCardRuleSet(state.cardRuleSetId || "standard").tradeBonusForIndex(Number.isInteger(state.tradeCount) ? state.tradeCount : 0),
      maxHandBeforeForcedTrade: getForcedTradeLimit(state),
      currentPlayerMustTrade: currentPlayer ? playerMustTradeCards(state, currentPlayer.id) : false
    }
  };
}

function startGame(state, random = Math.random) {
  const shuffledTerritories = shuffle(territories.map((territory) => territory.id), random);
  state.phase = "active";
  state.turnPhase = TurnPhase.REINFORCEMENT;
  state.winnerId = null;
  state.currentTurnIndex = 0;
  state.lastAction = null;
  state.pendingConquest = null;
  state.fortifyUsed = false;
  state.conqueredTerritoryThisTurn = false;

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
  const result = detectVictory(state, {
    appendLog(message) {
      appendLog(state, message.replace("conquers the map and wins the game.", "conquista la mappa e vince la partita."));
    }
  });

  return result.code === "VICTORY_DECLARED";
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
      state.pendingConquest = null;
      state.fortifyUsed = false;
      state.conqueredTerritoryThisTurn = false;
      appendLog(state, "Nuovo turno: " + candidate.name + " riceve " + state.reinforcementPool + " rinforzi.");
      return;
    }
  }
}

function addPlayer(state, name, options = {}) {
  const normalizedName = String(name || "").trim().slice(0, 24);
  const linkedUserId = options.isAi ? null : (options.linkedUserId || null);
  if (!normalizedName) {
    return { ok: false, error: "Inserisci un nome." };
  }

  const existing = state.players.find((player) => {
    if (player.isAi !== Boolean(options.isAi)) {
      return false;
    }

    if (!options.isAi && linkedUserId && player.linkedUserId === linkedUserId) {
      return true;
    }

    return player.name.toLowerCase() === normalizedName.toLowerCase();
  });
  if (existing) {
    existing.connected = true;
    if (options.isAi) {
      existing.isAi = true;
    } else if (linkedUserId && !existing.linkedUserId) {
      existing.linkedUserId = linkedUserId;
    }
    appendLog(state, existing.name + " si ricollega alla lobby.");
    return { ok: true, player: existing, rejoined: true };
  }

  if (state.phase !== "lobby") {
    return { ok: false, error: "La partita e gia iniziata." };
  }

  if (state.players.length >= 4) {
    return { ok: false, error: "La lobby e piena." };
  }

  const player = createPlayer({
    id: randomId(),
    name: normalizedName,
    color: palette[state.players.length % palette.length],
    connected: true,
    isAi: Boolean(options.isAi),
    linkedUserId
  });
  state.players.push(player);
  appendLog(state, player.name + " entra nella lobby.");
  return { ok: true, player, rejoined: false };
}

function applyReinforcement(state, playerId, territoryId) {
  const territoryState = state.territories[territoryId];
  const player = getPlayer(state, playerId);

  if (!player) {
    return { ok: false, message: "Giocatore non valido." };
  }

  if (state.phase !== "active") {
    return { ok: false, message: "La partita non e attiva." };
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return { ok: false, message: "Non e il tuo turno." };
  }

  if (state.reinforcementPool <= 0) {
    return { ok: false, message: "Non hai rinforzi disponibili." };
  }

  if (!territoryState || territoryState.ownerId !== playerId) {
    return { ok: false, message: "Puoi rinforzare solo un tuo territorio." };
  }

  territoryState.armies += 1;
  state.reinforcementPool -= 1;
  state.lastAction = {
    type: GameAction.REINFORCE,
    summary: player.name + " rinforza " + territoryId + "."
  };
  state.turnPhase = state.reinforcementPool === 0 && !playerMustTradeCards(state, playerId) ? TurnPhase.ATTACK : TurnPhase.REINFORCEMENT;
  appendLog(state, player.name + " aggiunge 1 armata a " + territoryId + ". Rinforzi rimasti: " + state.reinforcementPool + ".");
  return { ok: true };
}

function resolveAttack(state, playerId, fromId, toId, random = Math.random, requestedAttackDice = null) {
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

  if (playerMustTradeCards(state, playerId)) {
    return { ok: false, message: "Devi prima scambiare carte: hai superato il limite di mano." };
  }

  if (state.pendingConquest) {
    return { ok: false, message: "Devi prima spostare le armate nel territorio conquistato." };
  }

  if (from.ownerId !== playerId || to.ownerId === playerId) {
    return { ok: false, message: "Puoi attaccare solo da un tuo territorio verso uno nemico." };
  }

  if (territory.neighbors.indexOf(toId) === -1) {
    return { ok: false, message: "I territori non sono confinanti." };
  }

  if (from.armies < 2) {
    return { ok: false, message: "Servono almeno 2 armate per attaccare." };
  }

  state.turnPhase = TurnPhase.ATTACK;

  const defenderOwnerId = to.ownerId;
  const attackerArmiesBefore = from.armies;
  const defenderArmiesBefore = to.armies;
  const diceRuleSet = getDiceRuleSet(state.diceRuleSetId || "standard");
  const attackerReserve = diceRuleSet.attackerMustLeaveOneArmyBehind ? 1 : 0;
  const maxAttackDice = Math.min(diceRuleSet.attackerMaxDice, from.armies - attackerReserve);
  if (maxAttackDice < 1) {
    return { ok: false, message: "Non hai abbastanza armate per tirare dadi in attacco." };
  }
  const attackDiceCount = requestedAttackDice == null
    ? maxAttackDice
    : Number(requestedAttackDice);
  if (!Number.isInteger(attackDiceCount) || attackDiceCount < 1 || attackDiceCount > maxAttackDice) {
    return { ok: false, message: "Numero di dadi di attacco non valido." };
  }
  const defendDiceCount = Math.min(diceRuleSet.defenderMaxDice, to.armies);
  const attackRolls = rollCombatDice(attackDiceCount, random);
  const defendRolls = rollCombatDice(defendDiceCount, random);
  const { comparisons } = compareCombatDice(attackRolls, defendRolls, { defenderWinsTies: diceRuleSet.defenderWinsTies });
  let attackerLosses = 0;
  let defenderLosses = 0;

  comparisons.forEach((comparison) => {
    if (comparison.winner === "attacker") {
      defenderLosses += 1;
      return;
    }

    attackerLosses += 1;
  });

  from.armies -= attackerLosses;
  to.armies -= defenderLosses;
  let summary = attacker.name + " attacca " + toId + ": " + attackRolls.join("-") + " contro " + defendRolls.join("-") + ".";

  if (to.armies <= 0) {
    to.ownerId = playerId;
    to.armies = 0;
    state.pendingConquest = {
      fromId,
      toId,
      minArmies: 1,
      maxArmies: Math.max(1, from.armies - 1)
    };
    state.conqueredTerritoryThisTurn = true;
    summary += " " + attacker.name + " conquista " + toId + " e deve spostare armate.";
  } else if (defenderLosses > 0) {
    summary += " Il difensore perde " + defenderLosses + " armata" + (defenderLosses > 1 ? "e" : "") + ".";
  } else {
    summary = attacker.name + " fallisce l'attacco su " + toId + ": " + attackRolls.join("-") + " contro " + defendRolls.join("-") + ".";
  }

  const combat = {
    fromTerritoryId: fromId,
    toTerritoryId: toId,
    attackerPlayerId: playerId,
    defenderPlayerId: defenderOwnerId,
    diceRuleSetId: diceRuleSet.id || "standard",
    attackDiceCount,
    defendDiceCount,
    attackerRolls: attackRolls,
    defenderRolls: defendRolls,
    comparisons,
    attackerArmiesBefore,
    defenderArmiesBefore,
    attackerArmiesRemaining: from.armies,
    defenderArmiesRemaining: to.armies,
    defenderReducedToZero: to.armies <= 0,
    conqueredTerritory: Boolean(state.pendingConquest)
  };

  state.lastAction = { type: GameAction.ATTACK, summary, fromId, toId, combat };
  appendLog(state, summary);
  declareWinnerIfNeeded(state);
  return { ok: true, summary, combat, pendingConquest: state.pendingConquest };
}

function moveAfterConquest(state, playerId, armiesToMove) {
  const player = getPlayer(state, playerId);
  const pending = state.pendingConquest;

  if (!player) {
    return { ok: false, message: "Giocatore non valido." };
  }

  if (state.phase !== "active") {
    return { ok: false, message: "La partita non e attiva." };
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return { ok: false, message: "Non e il tuo turno." };
  }

  if (!pending) {
    return { ok: false, message: "Nessuna conquista in attesa." };
  }

  const moveCount = Number(armiesToMove);
  if (!Number.isInteger(moveCount)) {
    return { ok: false, message: "Inserisci un numero intero di armate." };
  }

  const from = state.territories[pending.fromId];
  const to = state.territories[pending.toId];
  const maxArmies = Math.max(1, from.armies - 1);

  if (moveCount < pending.minArmies) {
    return { ok: false, message: "Devi spostare almeno " + pending.minArmies + " armata." };
  }

  if (moveCount > maxArmies) {
    return { ok: false, message: "Devi lasciare almeno 1 armata nel territorio di partenza." };
  }

  from.armies -= moveCount;
  to.ownerId = playerId;
  to.armies = moveCount;
  state.pendingConquest = null;
  state.lastAction = {
    type: "moveAfterConquest",
    summary: player.name + " sposta " + moveCount + " armate in " + pending.toId + "."
  };
  appendLog(state, player.name + " sposta " + moveCount + " armate in " + pending.toId + ".");
  return { ok: true };
}

function applyFortify(state, playerId, fromId, toId, armiesToMove) {
  const player = getPlayer(state, playerId);
  const from = state.territories[fromId];
  const to = state.territories[toId];

  if (!player) {
    return { ok: false, message: "Giocatore non valido." };
  }

  if (state.phase !== "active") {
    return { ok: false, message: "La partita non e attiva." };
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return { ok: false, message: "Non e il tuo turno." };
  }

  if (state.turnPhase !== TurnPhase.FORTIFY) {
    return { ok: false, message: "Puoi fortificare solo nella fase di fortifica." };
  }

  if (state.fortifyUsed) {
    return { ok: false, message: "Hai gia usato la fortifica in questo turno." };
  }

  if (!from || !to || fromId === toId) {
    return { ok: false, message: "Seleziona due territori validi e distinti." };
  }

  if (from.ownerId !== playerId || to.ownerId !== playerId) {
    return { ok: false, message: "Puoi spostare armate solo tra tuoi territori." };
  }

  const territory = territories.find((item) => item.id === fromId);
  if (!territory || territory.neighbors.indexOf(toId) === -1) {
    return { ok: false, message: "Puoi fortificare solo tra territori adiacenti." };
  }

  const moveCount = Number(armiesToMove);
  if (!Number.isInteger(moveCount) || moveCount < 1) {
    return { ok: false, message: "Inserisci almeno 1 armata da spostare." };
  }

  if (from.armies - moveCount < 1) {
    return { ok: false, message: "Devi lasciare almeno 1 armata nel territorio di partenza." };
  }

  from.armies -= moveCount;
  to.armies += moveCount;
  state.fortifyUsed = true;
  state.lastAction = {
    type: "fortify",
    summary: player.name + " sposta " + moveCount + " armate da " + fromId + " a " + toId + "."
  };
  appendLog(state, player.name + " sposta " + moveCount + " armate da " + fromId + " a " + toId + ".");
  return { ok: true };
}

function endTurn(state, playerId) {
  const player = getPlayer(state, playerId);

  if (!player) {
    return { ok: false, message: "Giocatore non valido." };
  }

  if (state.phase !== "active") {
    return { ok: false, message: "La partita non e attiva." };
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return { ok: false, message: "Non e il tuo turno." };
  }

  if (state.reinforcementPool > 0) {
    return { ok: false, message: "Spendi prima tutti i rinforzi." };
  }

  if (playerMustTradeCards(state, playerId)) {
    return { ok: false, message: "Devi prima scambiare carte: hai superato il limite di mano." };
  }

  if (state.pendingConquest) {
    return { ok: false, message: "Sposta prima le armate nel territorio conquistato." };
  }

  if (state.turnPhase === TurnPhase.ATTACK) {
    state.turnPhase = TurnPhase.FORTIFY;
    state.fortifyUsed = false;
    appendLog(state, player.name + " entra nella fase di fortifica.");
    return { ok: true, requiresFortifyDecision: true };
  }

  const awardedCard = awardTurnCardIfEligible(state, playerId);
  appendLog(state, player.name + " termina il turno.");
  advanceTurn(state);
  return { ok: true, awardedCard };
}

module.exports = {
  GameAction,
  TurnPhase,
  addPlayer,
  advanceTurn,
  appendLog,
  applyFortify,
  applyReinforcement,
  computeReinforcements,
  continents,
  createInitialState,
  declareWinnerIfNeeded,
  endTurn,
  getCurrentPlayer,
  getPlayer,
  palette,
  moveAfterConquest,
  publicState,
  resolveAttack,
  awardTurnCardIfEligible,
  startGame,
  territories,
  territoriesOwnedBy,
  tradeCardSet,
  playerMustTradeCards
};



