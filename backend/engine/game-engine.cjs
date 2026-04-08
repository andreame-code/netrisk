const crypto = require("crypto");
const { secureRandom } = require("../random.cjs");
const {
  GameAction,
  TurnPhase,
  createActionFailure,
  createDefaultGameModeDefinition,
  createDomainFailure,
  createLogEntry,
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
const { calculateReinforcements } = require("./reinforcement-calculator.cjs");
const { findSupportedMap } = require("../../shared/maps/index.cjs");
const { applyRuleHook } = require("./rule-modules/index.cjs");

const defaultMap = findSupportedMap("classic-mini");
const territories = defaultMap ? defaultMap.territories : [];
const continents = defaultMap ? defaultMap.continents : [];
const palette = ["#e85d04", "#0f4c5c", "#6a994e", "#8338ec"];

function resolveGameModeDefinition(selectedMap, existingDefinition = null) {
  if (existingDefinition && typeof existingDefinition === "object") {
    return existingDefinition;
  }

  return createDefaultGameModeDefinition({
    mapId: selectedMap && selectedMap.id ? selectedMap.id : "classic-mini"
  });
}

function createInitialState(selectedMap = defaultMap, gameModeDefinition = null) {
  const mapTerritories = Array.isArray(selectedMap && selectedMap.territories) && selectedMap.territories.length
    ? selectedMap.territories
    : territories;
  const mapContinents = Array.isArray(selectedMap && selectedMap.continents) && selectedMap.continents.length
    ? selectedMap.continents
    : continents;
  const resolvedGameModeDefinition = resolveGameModeDefinition(selectedMap, gameModeDefinition);

  const state = createGameState({
    phase: "lobby",
    turnPhase: TurnPhase.LOBBY,
    players: [],
    territories: Object.fromEntries(
      mapTerritories.map((territory) => [territory.id, { ownerId: null, armies: 0 }])
    ),
    continents: mapContinents,
    mapId: selectedMap && selectedMap.id ? selectedMap.id : "classic-mini",
    mapName: selectedMap && selectedMap.name ? selectedMap.name : "Classic Mini",
    mapTerritories,
    mapPositions: selectedMap && selectedMap.positions ? selectedMap.positions : {},
    mapImageUrl: selectedMap && selectedMap.backgroundImage ? selectedMap.backgroundImage : null,
    mapAspectRatio: selectedMap && selectedMap.aspectRatio ? selectedMap.aspectRatio : null,
    gameModeDefinition: resolvedGameModeDefinition,
    currentTurnIndex: 0,
    reinforcementPool: 0,
    winnerId: null,
    log: ["Lobby creata. Unisciti e avvia la partita."],
    logEntries: [createLogEntry("Lobby creata. Unisciti e avvia la partita.", "game.log.lobbyCreated")],
    lastAction: null,
    pendingConquest: null,
    fortifyUsed: false,
    cardRuleSetId: "standard",
    deck: createStandardDeck(mapTerritories.map((territory) => territory.id)),
    discardPile: [],
    hands: {},
    tradeCount: 0,
    conqueredTerritoryThisTurn: false
  });

  state.diceRuleSetId = resolvedGameModeDefinition.diceRuleSetId;

  applyRuleHook(state, "onSetup", {
    setupStage: "initial-state"
  });

  return state;
}

function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

function shuffle(list, random = secureRandom) {
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

function getMapTerritories(state) {
  return Array.isArray(state && state.mapTerritories) && state.mapTerritories.length
    ? state.mapTerritories
    : territories;
}

function getMapPositions(state) {
  return state && state.mapPositions ? state.mapPositions : {};
}

function getMapPositions(state) {
  return state && state.mapPositions ? state.mapPositions : {};
}

function territoriesOwnedBy(state, playerId) {
  return getMapTerritories(state).filter((territory) => state.territories[territory.id].ownerId === playerId);
}

function isPlayerAlive(state, player) {
  return Boolean(player && !player.surrendered && territoriesOwnedBy(state, player.id).length > 0);
}

function computeReinforcements(state, playerId) {
  return calculateReinforcements(state, playerId).totalReinforcements;
}

function appendLog(state, message, messageKey = null, messageParams = {}) {
  if (!Array.isArray(state.logEntries)) {
    state.logEntries = [];
  }
  state.logEntries.unshift(createLogEntry(message, messageKey, messageParams));
  state.logEntries = state.logEntries.slice(0, 12);
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

function refillDeckFromDiscardIfNeeded(state, random = secureRandom) {
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

function awardTurnCardIfEligible(state, playerId, random = secureRandom) {
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
  appendLog(state, player.name + " riceve una carta territorio.", "game.log.turnCardAwarded", { playerName: player.name });
  return nextCard;
}

function tradeCardSet(state, playerId, cardIds) {
  const player = getPlayer(state, playerId);
  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return createActionFailure("Non e il tuo turno.", "game.notYourTurn");
  }

  if (state.turnPhase !== TurnPhase.REINFORCEMENT) {
    return createActionFailure("Puoi scambiare carte solo nella fase di rinforzo.", "game.tradeCards.reinforcementOnly");
  }

  if (!Array.isArray(cardIds) || cardIds.length !== 3) {
    return createActionFailure("Devi selezionare esattamente 3 carte.", "game.tradeCards.exactlyThree");
  }

  const uniqueCardIds = [...new Set(cardIds)];
  if (uniqueCardIds.length !== 3) {
    return createActionFailure("Non puoi usare la stessa carta due volte.", "game.tradeCards.noDuplicateCards");
  }

  const hand = ensurePlayerHand(state, playerId);
  const selectedCards = uniqueCardIds.map((cardId) => hand.find((card) => card.id === cardId));
  if (selectedCards.some((card) => !card)) {
    return createActionFailure("Le carte selezionate non sono disponibili nella mano del giocatore.", "game.tradeCards.cardsUnavailable");
  }

  const validation = validateStandardCardSet(selectedCards);
  if (!validation.ok) {
    return createActionFailure(validation.reason, validation.reasonKey, validation.reasonParams);
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
    summary: player.name + " scambia un set di carte e riceve " + bonus + " rinforzi.",
    summaryKey: "game.log.tradeCompleted",
    summaryParams: {
      playerName: player.name,
      bonus
    }
  };
  appendLog(state, player.name + " scambia un set di carte e riceve " + bonus + " rinforzi.", "game.log.tradeCompleted", {
    playerName: player.name,
    bonus
  });
  return { ok: true, bonus, validation };
}

function readableMapName(mapId) {
  const map = findSupportedMap(mapId);
  return map ? map.name : (mapId || null);
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
      surrendered: Boolean(player.surrendered),
      territoryCount: territoriesOwnedBy(state, player.id).length,
      eliminated: state.phase !== "lobby" && !isPlayerAlive(state, player),
      cardCount: Array.isArray(state.hands?.[player.id]) ? state.hands[player.id].length : 0
    })),
    map: getMapTerritories(state).map((territory) => ({
      id: territory.id,
      name: territory.name,
      neighbors: territory.neighbors,
      continentId: territory.continentId,
      ownerId: state.territories[territory.id].ownerId,
      armies: state.territories[territory.id].armies,
      x: getMapPositions(state)[territory.id] ? getMapPositions(state)[territory.id].x : null,
      y: getMapPositions(state)[territory.id] ? getMapPositions(state)[territory.id].y : null
    })),
    continents: state.continents,
    mapVisual: {
      imageUrl: state.mapImageUrl || null,
      aspectRatio: state.mapAspectRatio || null
    },
    communityId: state.communityId || null,
    gameModeId: state.gameModeId || null,
    currentPlayerId: currentPlayer ? currentPlayer.id : null,
    reinforcementPool: state.reinforcementPool,
    winnerId: state.winnerId,
    gameModeDefinition: state.gameModeDefinition || null,
    gameConfig: state.gameConfig
      ? {
          ...state.gameConfig,
          mapName: state.gameConfig.mapName || readableMapName(state.gameConfig.mapId)
        }
      : null,
    log: state.log,
    logEntries: state.logEntries,
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

function startGame(state, random = secureRandom) {
  const mapTerritories = getMapTerritories(state);
  applyRuleHook(state, "onSetup", {
    setupStage: "before-start"
  });
  const shuffledTerritories = shuffle(mapTerritories.map((territory) => territory.id), random);
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
    player.surrendered = false;
    state.territories[territoryId] = { ownerId: player.id, armies: 1 };
  });

  const firstPlayer = getCurrentPlayer(state);
  state.reinforcementPool = computeReinforcements(state, firstPlayer.id);
  applyRuleHook(state, "onTurnStarted", {
    player: firstPlayer,
    playerId: firstPlayer.id
  });
  appendLog(state, "Partita iniziata. Turno di " + firstPlayer.name + " con " + state.reinforcementPool + " rinforzi.", "game.log.gameStarted", {
    playerName: firstPlayer.name,
    reinforcementPool: state.reinforcementPool
  });
}

function declareWinnerIfNeeded(state) {
  const result = detectVictory(state);
  if (result.code === "AI_ONLY_REMAIN") {
    appendLog(state, "La partita si chiude: restano attive solo AI.", "game.log.aiOnlyRemain", result.messageParams || {});
  } else if (result.code === "VICTORY_DECLARED" && result.victory) {
    appendLog(
      state,
      result.victory.summary.replace("conquers the map and wins the game.", "conquista la mappa e vince la partita."),
      result.victory.summaryKey || "game.log.victoryDeclared",
      result.victory.summaryParams || { playerName: result.victory.winnerName }
    );
  }

  return state.phase === "finished";
}

function advanceTurn(state) {
  if (state.winnerId || declareWinnerIfNeeded(state)) {
    return;
  }

  let nextIndex = state.currentTurnIndex;
  for (let step = 0; step < state.players.length; step += 1) {
    nextIndex = (nextIndex + 1) % state.players.length;
    const candidate = state.players[nextIndex];
    if (isPlayerAlive(state, candidate)) {
      state.currentTurnIndex = nextIndex;
      state.turnPhase = TurnPhase.REINFORCEMENT;
      state.reinforcementPool = computeReinforcements(state, candidate.id);
      state.pendingConquest = null;
      state.fortifyUsed = false;
      state.conqueredTerritoryThisTurn = false;
      applyRuleHook(state, "onTurnStarted", {
        player: candidate,
        playerId: candidate.id
      });
      appendLog(state, "Nuovo turno: " + candidate.name + " riceve " + state.reinforcementPool + " rinforzi.", "game.log.turnStarted", {
        playerName: candidate.name,
        reinforcementPool: state.reinforcementPool
      });
      return;
    }
  }
}

function addPlayer(state, name, options = {}) {
  const normalizedName = String(name || "").trim().slice(0, 24);
  const linkedUserId = options.isAi ? null : (options.linkedUserId || null);
  const maxPlayers = Number.isInteger(state?.gameConfig?.totalPlayers) && state.gameConfig.totalPlayers > 0
    ? state.gameConfig.totalPlayers
    : 4;
  if (!normalizedName) {
    return createDomainFailure("Inserisci un nome.", "game.addPlayer.nameRequired");
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
    appendLog(state, existing.name + " si ricollega alla lobby.", "game.log.playerRejoined", { playerName: existing.name });
    return { ok: true, player: existing, rejoined: true };
  }

  if (state.phase !== "lobby") {
    return createDomainFailure("La partita e gia iniziata.", "game.addPlayer.alreadyStarted");
  }

  if (state.players.length >= maxPlayers) {
    return createDomainFailure("La lobby e piena.", "game.addPlayer.lobbyFull");
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
  appendLog(state, player.name + " entra nella lobby.", "game.log.playerJoined", { playerName: player.name });
  return { ok: true, player, rejoined: false };
}

function applyReinforcement(state, playerId, territoryId, requestedAmount = 1) {
  const territoryState = state.territories[territoryId];
  const player = getPlayer(state, playerId);
  const reinforcementAmount = Math.floor(Number(requestedAmount));

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return createActionFailure("Non e il tuo turno.", "game.notYourTurn");
  }

  if (state.reinforcementPool <= 0) {
    return createActionFailure("Non hai rinforzi disponibili.", "game.reinforce.noneAvailable");
  }

  if (!Number.isFinite(reinforcementAmount) || reinforcementAmount <= 0) {
    return createActionFailure("Quantita rinforzi non valida.", "game.reinforce.invalidAmount");
  }

  if (reinforcementAmount > state.reinforcementPool) {
    return createActionFailure("Stai tentando di usare piu rinforzi di quelli disponibili.", "game.reinforce.tooMany");
  }

  if (!territoryState || territoryState.ownerId !== playerId) {
    return createActionFailure("Puoi rinforzare solo un tuo territorio.", "game.reinforce.mustOwnTerritory");
  }

  territoryState.armies += reinforcementAmount;
  state.reinforcementPool -= reinforcementAmount;
  state.lastAction = {
    type: GameAction.REINFORCE,
    summary: player.name + " rinforza " + territoryId + " con " + reinforcementAmount + " armate.",
    summaryKey: "game.log.reinforced",
    summaryParams: {
      playerName: player.name,
      reinforcementAmount,
      territoryId,
      reinforcementPool: state.reinforcementPool
    }
  };
  state.turnPhase = state.reinforcementPool === 0 && !playerMustTradeCards(state, playerId) ? TurnPhase.ATTACK : TurnPhase.REINFORCEMENT;
  appendLog(
    state,
    player.name + " aggiunge " + reinforcementAmount + " " + (reinforcementAmount === 1 ? "armata" : "armate") + " a " + territoryId + ". Rinforzi rimasti: " + state.reinforcementPool + ".",
    "game.log.reinforced",
    {
      playerName: player.name,
      reinforcementAmount,
      territoryId,
      reinforcementPool: state.reinforcementPool
    }
  );
  return { ok: true };
}

function resolveAttack(state, playerId, fromId, toId, random = secureRandom, requestedAttackDice = null) {
  const attacker = getPlayer(state, playerId);
  const from = state.territories[fromId];
  const to = state.territories[toId];
  const territory = getMapTerritories(state).find((item) => item.id === fromId);

  if (!attacker || !from || !to || !territory) {
    return createActionFailure("Territori non validi.", "game.attack.invalidTerritories");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return createActionFailure("Non e il tuo turno.", "game.notYourTurn");
  }

  if (state.reinforcementPool > 0) {
    return createActionFailure("Devi prima spendere tutti i rinforzi.", "game.attack.mustSpendReinforcements");
  }

  if (playerMustTradeCards(state, playerId)) {
    return createActionFailure("Devi prima scambiare carte: hai superato il limite di mano.", "game.attack.mustTradeCards");
  }

  if (state.pendingConquest) {
    return createActionFailure("Devi prima spostare le armate nel territorio conquistato.", "game.attack.mustMoveAfterConquest");
  }

  if (from.ownerId !== playerId || to.ownerId === playerId) {
    return createActionFailure("Puoi attaccare solo da un tuo territorio verso uno nemico.", "game.attack.invalidOwnership");
  }

  if (territory.neighbors.indexOf(toId) === -1) {
    return createActionFailure("I territori non sono confinanti.", "game.attack.notAdjacent");
  }

  if (from.armies < 2) {
    return createActionFailure("Servono almeno 2 armate per attaccare.", "game.attack.notEnoughArmies");
  }

  const validationHookResults = applyRuleHook(state, "onValidateAttack", {
    attacker,
    playerId,
    fromId,
    toId,
    from,
    to
  });
  const blockingResult = validationHookResults.find((result) => result && result.ok === false);
  if (blockingResult) {
    return blockingResult;
  }

  state.turnPhase = TurnPhase.ATTACK;

  const defenderOwnerId = to.ownerId;
  const attackerArmiesBefore = from.armies;
  const defenderArmiesBefore = to.armies;
  const diceRuleSet = getDiceRuleSet(state.diceRuleSetId || "standard");
  const attackerReserve = diceRuleSet.attackerMustLeaveOneArmyBehind ? 1 : 0;
  const maxAttackDice = Math.min(diceRuleSet.attackerMaxDice, from.armies - attackerReserve);
  if (maxAttackDice < 1) {
    return createActionFailure("Non hai abbastanza armate per tirare dadi in attacco.", "game.attack.notEnoughDiceArmies");
  }
  const attackDiceCount = requestedAttackDice == null
    ? maxAttackDice
    : Number(requestedAttackDice);
  if (!Number.isInteger(attackDiceCount) || attackDiceCount < 1 || attackDiceCount > maxAttackDice) {
    return createActionFailure("Numero di dadi di attacco non valido.", "game.attack.invalidDiceCount");
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
    applyRuleHook(state, "onAfterConquest", {
      attacker,
      playerId,
      fromId,
      toId
    });
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

  state.lastAction = {
    type: GameAction.ATTACK,
    summary,
    summaryKey: state.pendingConquest ? "game.log.attackConquered" : defenderLosses > 0 ? "game.log.attackDamaged" : "game.log.attackFailed",
    summaryParams: {
      attackerName: attacker.name,
      toId,
      attackRolls: attackRolls.join("-"),
      defendRolls: defendRolls.join("-"),
      defenderLosses
    },
    fromId,
    toId,
    combat
  };
  appendLog(state, summary, state.pendingConquest ? "game.log.attackConquered" : defenderLosses > 0 ? "game.log.attackDamaged" : "game.log.attackFailed", {
    attackerName: attacker.name,
    toId,
    attackRolls: attackRolls.join("-"),
    defendRolls: defendRolls.join("-"),
    defenderLosses
  });
  declareWinnerIfNeeded(state);
  return { ok: true, summary, combat, pendingConquest: state.pendingConquest };
}

function moveAfterConquest(state, playerId, armiesToMove) {
  const player = getPlayer(state, playerId);
  const pending = state.pendingConquest;

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return createActionFailure("Non e il tuo turno.", "game.notYourTurn");
  }

  if (!pending) {
    return createActionFailure("Nessuna conquista in attesa.", "game.conquest.nonePending");
  }

  const moveCount = Number(armiesToMove);
  if (!Number.isInteger(moveCount)) {
    return createActionFailure("Inserisci un numero intero di armate.", "game.conquest.invalidArmyCount");
  }

  const from = state.territories[pending.fromId];
  const to = state.territories[pending.toId];
  const maxArmies = Math.max(1, from.armies - 1);

  if (moveCount < pending.minArmies) {
    return createActionFailure("Devi spostare almeno " + pending.minArmies + " armata.", "game.conquest.minArmies", { minArmies: pending.minArmies });
  }

  if (moveCount > maxArmies) {
    return createActionFailure("Devi lasciare almeno 1 armata nel territorio di partenza.", "game.conquest.leaveOneBehind");
  }

  from.armies -= moveCount;
  to.ownerId = playerId;
  to.armies = moveCount;
  state.pendingConquest = null;
  state.lastAction = {
    type: "moveAfterConquest",
    summary: player.name + " sposta " + moveCount + " armate in " + pending.toId + ".",
    summaryKey: "game.log.moveAfterConquest",
    summaryParams: {
      playerName: player.name,
      moveCount,
      territoryId: pending.toId
    }
  };
  appendLog(state, player.name + " sposta " + moveCount + " armate in " + pending.toId + ".", "game.log.moveAfterConquest", {
    playerName: player.name,
    moveCount,
    territoryId: pending.toId
  });
  return { ok: true };
}

function applyFortify(state, playerId, fromId, toId, armiesToMove) {
  const player = getPlayer(state, playerId);
  const from = state.territories[fromId];
  const to = state.territories[toId];

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return createActionFailure("Non e il tuo turno.", "game.notYourTurn");
  }

  if (state.turnPhase !== TurnPhase.FORTIFY) {
    return createActionFailure("Puoi fortificare solo nella fase di fortifica.", "game.fortify.phaseOnly");
  }

  if (state.fortifyUsed) {
    return createActionFailure("Hai gia usato la fortifica in questo turno.", "game.fortify.alreadyUsed");
  }

  if (!from || !to || fromId === toId) {
    return createActionFailure("Seleziona due territori validi e distinti.", "game.fortify.invalidTerritories");
  }

  if (from.ownerId !== playerId || to.ownerId !== playerId) {
    return createActionFailure("Puoi spostare armate solo tra tuoi territori.", "game.fortify.mustOwnTerritories");
  }

  const territory = getMapTerritories(state).find((item) => item.id === fromId);
  if (!territory || territory.neighbors.indexOf(toId) === -1) {
    return createActionFailure("Puoi fortificare solo tra territori adiacenti.", "game.fortify.notAdjacent");
  }

  const moveCount = Number(armiesToMove);
  if (!Number.isInteger(moveCount) || moveCount < 1) {
    return createActionFailure("Inserisci almeno 1 armata da spostare.", "game.fortify.invalidArmyCount");
  }

  if (from.armies - moveCount < 1) {
    return createActionFailure("Devi lasciare almeno 1 armata nel territorio di partenza.", "game.fortify.leaveOneBehind");
  }

  from.armies -= moveCount;
  to.armies += moveCount;
  state.fortifyUsed = true;
  state.lastAction = {
    type: "fortify",
    summary: player.name + " sposta " + moveCount + " armate da " + fromId + " a " + toId + ".",
    summaryKey: "game.log.fortified",
    summaryParams: {
      playerName: player.name,
      moveCount,
      fromId,
      toId
    }
  };
  appendLog(state, player.name + " sposta " + moveCount + " armate da " + fromId + " a " + toId + ".", "game.log.fortified", {
    playerName: player.name,
    moveCount,
    fromId,
    toId
  });
  return { ok: true };
}

function endTurn(state, playerId) {
  const player = getPlayer(state, playerId);

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state).id !== playerId) {
    return createActionFailure("Non e il tuo turno.", "game.notYourTurn");
  }

  if (state.reinforcementPool > 0) {
    return createActionFailure("Spendi prima tutti i rinforzi.", "game.endTurn.mustSpendReinforcements");
  }

  if (playerMustTradeCards(state, playerId)) {
    return createActionFailure("Devi prima scambiare carte: hai superato il limite di mano.", "game.endTurn.mustTradeCards");
  }

  if (state.pendingConquest) {
    return createActionFailure("Sposta prima le armate nel territorio conquistato.", "game.endTurn.mustMoveAfterConquest");
  }

  applyRuleHook(state, "onBeforeEndTurn", {
    player,
    playerId
  });

  if (state.turnPhase === TurnPhase.ATTACK) {
    state.turnPhase = TurnPhase.FORTIFY;
    state.fortifyUsed = false;
    appendLog(state, player.name + " entra nella fase di fortifica.", "game.log.enterFortify", { playerName: player.name });
    return { ok: true, requiresFortifyDecision: true };
  }

  const awardedCard = awardTurnCardIfEligible(state, playerId);
  appendLog(state, player.name + " termina il turno.", "game.log.endTurn", { playerName: player.name });
  advanceTurn(state);
  applyRuleHook(state, "onAfterEndTurn", {
    player,
    playerId,
    awardedCard
  });
  return { ok: true, awardedCard };
}

function surrenderPlayer(state, playerId) {
  const player = getPlayer(state, playerId);

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("Puoi arrenderti solo durante una partita attiva.", "game.surrender.activeOnly");
  }

  if (player.surrendered) {
    return createActionFailure("Il giocatore si e gia arreso.", "game.surrender.alreadySurrendered");
  }

  if (territoriesOwnedBy(state, playerId).length === 0) {
    return createActionFailure("Il giocatore e gia eliminato.", "game.surrender.alreadyEliminated");
  }

  if (Array.isArray(state.hands?.[playerId]) && state.hands[playerId].length > 0) {
    if (!Array.isArray(state.discardPile)) {
      state.discardPile = [];
    }
    state.discardPile.push(...state.hands[playerId]);
  }
  if (state.hands) {
    state.hands[playerId] = [];
  }

  player.connected = false;
  player.surrendered = true;
  if (getCurrentPlayer(state)?.id === playerId) {
    state.pendingConquest = null;
    state.reinforcementPool = 0;
    state.fortifyUsed = false;
  }

  const summary = player.name + " si arrende e abbandona la partita.";
  state.lastAction = {
    type: GameAction.SURRENDER,
    summary,
    summaryKey: "game.log.surrender",
    summaryParams: { playerName: player.name },
    playerId
  };
  appendLog(state, summary, "game.log.surrender", { playerName: player.name });

  if (declareWinnerIfNeeded(state)) {
    return { ok: true, eliminatedPlayerId: playerId, winnerId: state.winnerId };
  }

  if (getCurrentPlayer(state)?.id === playerId) {
    advanceTurn(state);
  }

  return { ok: true, eliminatedPlayerId: playerId, winnerId: state.winnerId };
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
  getMapTerritories,
  getPlayer,
  palette,
  moveAfterConquest,
  publicState,
  resolveGameModeDefinition,
  resolveAttack,
  awardTurnCardIfEligible,
  surrenderPlayer,
  startGame,
  territories,
  territoriesOwnedBy,
  tradeCardSet,
  playerMustTradeCards
};

