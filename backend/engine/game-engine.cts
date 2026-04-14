import crypto from "node:crypto";
import {
  GameAction,
  TurnPhase,
  createActionFailure,
  createDomainFailure,
  createLogEntry,
  createGameState,
  createPlayer,
  createStandardDeck,
  getCardRuleSet,
  getDiceRuleSet,
  getPieceSkin,
  migrateGameConfigExtensions,
  migrateGameStateExtensions,
  standardTradeBonusForIndex,
  validateStandardCardSet,
  type ActionFailure,
  type Card,
  type DomainFailure,
  type GameState,
  type MessageParams,
  type Player,
  type Territory
} from "../../shared/models.cjs";
import { detectVictory } from "./victory-detection.cjs";
import { compareCombatDice, rollCombatDice } from "./combat-dice.cjs";
import { calculateReinforcements } from "./reinforcement-calculator.cjs";
import { findSupportedMap } from "../../shared/maps/index.cjs";
const { secureRandom } = require("../random.cjs");

export { GameAction, TurnPhase };

type LoadedMap = NonNullable<ReturnType<typeof findSupportedMap>> & {
  backgroundImage?: string | null;
  aspectRatio?: number | null;
};
type TerritoryDefinition = Territory & { id: string; neighbors: string[] };
type MapPositions = Record<string, { x: number | null; y: number | null }>;

export interface PendingConquest {
  fromId: string;
  toId: string;
  minArmies: number;
  maxArmies: number;
}

export interface GameConfig {
  totalPlayers?: number;
  mapId?: string;
  mapName?: string;
  turnTimeoutHours?: number | null;
  [key: string]: unknown;
}

interface CombatSnapshot {
  fromTerritoryId: string;
  toTerritoryId: string;
  attackerPlayerId: string;
  defenderPlayerId: string | null;
  diceRuleSetId: string;
  attackDiceCount: number;
  defendDiceCount: number;
  attackerRolls: number[];
  defenderRolls: number[];
  comparisons: Array<{ winner: "attacker" | "defender"; attackDie: number; defendDie: number; pair: number }>;
  attackerArmiesBefore: number;
  defenderArmiesBefore: number;
  attackerArmiesRemaining: number;
  defenderArmiesRemaining: number;
  defenderReducedToZero: boolean;
  conqueredTerritory: boolean;
}

type EngineState = GameState & {
  mapTerritories: TerritoryDefinition[];
  mapPositions: MapPositions;
  mapImageUrl: string | null;
  mapAspectRatio: unknown;
  pendingConquest: PendingConquest | null;
  gameConfig?: GameConfig | null;
  fortifyUsed: boolean;
  lastAction: Record<string, unknown> | null;
};

type AddPlayerOptions = {
  isAi?: boolean;
  linkedUserId?: string | null;
};

type AddPlayerResult = DomainFailure | { ok: true; player: Player; rejoined: boolean };
type BasicOk = { ok: true };
type BasicResult = ActionFailure | BasicOk;

const defaultMap = findSupportedMap("classic-mini");
export const territories: TerritoryDefinition[] = defaultMap ? (defaultMap.territories as TerritoryDefinition[]) : [];
export const continents = defaultMap ? defaultMap.continents : [];
export const palette = ["#e85d04", "#0f4c5c", "#6a994e", "#8338ec"];

export function createInitialState(selectedMap: LoadedMap | null = defaultMap): EngineState {
  const sourceMap = selectedMap || defaultMap;
  const visualMap = sourceMap as (LoadedMap & Record<string, unknown>) | null;
  const mapTerritories = Array.isArray(sourceMap?.territories) && sourceMap.territories.length
    ? (sourceMap.territories as TerritoryDefinition[])
    : territories;
  const mapContinents = Array.isArray(sourceMap?.continents) && sourceMap.continents.length
    ? sourceMap.continents
    : continents;

  return createGameState({
    phase: "lobby",
    turnPhase: TurnPhase.LOBBY,
    players: [],
    territories: Object.fromEntries(
      mapTerritories.map((territory) => [territory.id, { ownerId: null, armies: 0 }])
    ),
    continents: mapContinents,
    mapId: sourceMap && sourceMap.id ? sourceMap.id : "classic-mini",
    mapName: sourceMap && sourceMap.name ? sourceMap.name : "Classic Mini",
    mapTerritories,
    mapPositions: sourceMap && sourceMap.positions ? sourceMap.positions : {},
    mapImageUrl: visualMap && typeof visualMap.backgroundImage === "string" ? visualMap.backgroundImage : null,
    mapAspectRatio: visualMap && "aspectRatio" in visualMap ? visualMap.aspectRatio : null,
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
    conqueredTerritoryThisTurn: false,
    gameConfig: migrateGameConfigExtensions({
      ruleSetId: "classic",
      ruleSetName: "Classic",
      mapId: sourceMap && sourceMap.id ? sourceMap.id : "classic-mini",
      mapName: sourceMap && sourceMap.name ? sourceMap.name : "Classic Mini",
      diceRuleSetId: "standard"
    })
  }) as EngineState;
}

function randomId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function currentUtcTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}

function shuffle<T>(list: T[], random: () => number = secureRandom): T[] {
  const copy = list.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = copy[index] as T;
    copy[index] = copy[swapIndex] as T;
    copy[swapIndex] = current;
  }
  return copy;
}

export function getPlayer(state: EngineState, playerId: string): Player | null {
  return state.players.find((player) => player.id === playerId) || null;
}

export function getCurrentPlayer(state: EngineState): Player | null {
  return state.players.length ? state.players[state.currentTurnIndex] || null : null;
}

export function getMapTerritories(state: EngineState): TerritoryDefinition[] {
  return Array.isArray(state && state.mapTerritories) && state.mapTerritories.length
    ? state.mapTerritories
    : territories;
}

function getMapPositions(state: EngineState): MapPositions {
  return state && state.mapPositions ? state.mapPositions : {};
}

export function territoriesOwnedBy(state: EngineState, playerId: string): TerritoryDefinition[] {
  return getMapTerritories(state).filter((territory) => state.territories[territory.id]?.ownerId === playerId);
}

function isPlayerAlive(state: EngineState, player: Player | null): boolean {
  return Boolean(player && player.id && !player.surrendered && territoriesOwnedBy(state, player.id).length > 0);
}

export function computeReinforcements(state: EngineState, playerId: string): number {
  return calculateReinforcements(state, playerId).totalReinforcements;
}

export function appendLog(
  state: EngineState,
  message: string,
  messageKey: string | null = null,
  messageParams: MessageParams = {}
): void {
  if (!Array.isArray(state.logEntries)) {
    state.logEntries = [];
  }
  state.logEntries.unshift(createLogEntry(message, messageKey, messageParams));
  state.logEntries = state.logEntries.slice(0, 12);
  state.log.unshift(message);
  state.log = state.log.slice(0, 12);
}

function ensurePlayerHand(state: EngineState, playerId: string): Card[] {
  if (!Array.isArray(state.hands[playerId])) {
    state.hands[playerId] = [];
  }
  return state.hands[playerId] as Card[];
}

function getForcedTradeLimit(state: EngineState): number {
  return getCardRuleSet(state.cardRuleSetId || "standard").maxHandBeforeForcedTrade || 5;
}

export function playerMustTradeCards(state: EngineState, playerId: string): boolean {
  return ensurePlayerHand(state, playerId).length > getForcedTradeLimit(state);
}

function refillDeckFromDiscardIfNeeded(state: EngineState, random: () => number = secureRandom): boolean {
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

export function awardTurnCardIfEligible(state: EngineState, playerId: string, random: () => number = secureRandom): Card | null {
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
  if (!nextCard) {
    return null;
  }

  ensurePlayerHand(state, playerId).push(nextCard);
  state.conqueredTerritoryThisTurn = false;
  appendLog(state, player.name + " riceve una carta territorio.", "game.log.turnCardAwarded", { playerName: player.name });
  return nextCard;
}

export function tradeCardSet(state: EngineState, playerId: string, cardIds: string[]): ActionFailure | { ok: true; bonus: number; validation: ReturnType<typeof validateStandardCardSet> } {
  const player = getPlayer(state, playerId);
  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state)?.id !== playerId) {
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

  const resolvedCards = selectedCards as Card[];
  const validation = validateStandardCardSet(resolvedCards);
  if (!validation.ok) {
    return createActionFailure(validation.reason, validation.reasonKey, validation.reasonParams);
  }

  const bonus = standardTradeBonusForIndex(state.tradeCount || 0);
  state.hands[playerId] = hand.filter((card) => !card.id || !uniqueCardIds.includes(card.id));
  if (!Array.isArray(state.discardPile)) {
    state.discardPile = [];
  }
  state.discardPile.push(...resolvedCards);
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

function readableMapName(mapId: string | null | undefined): string | null {
  const map = findSupportedMap(mapId || "");
  return map ? map.name : (mapId || null);
}

export function publicState(state: EngineState) {
  migrateGameStateExtensions(state);
  const currentPlayer = getCurrentPlayer(state);
  const diceRuleSet = getDiceRuleSet(state.diceRuleSetId || "standard");
  const lastAction = state.lastAction as ({ type?: string; combat?: CombatSnapshot | null } & Record<string, unknown>) | null;

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
      territoryCount: player.id ? territoriesOwnedBy(state, player.id).length : 0,
      eliminated: state.phase !== "lobby" && !isPlayerAlive(state, player),
      cardCount: player.id && Array.isArray(state.hands?.[player.id]) ? state.hands[player.id].length : 0
    })),
    map: getMapTerritories(state).map((territory) => ({
      id: territory.id,
      name: territory.name,
      neighbors: territory.neighbors,
      continentId: territory.continentId,
      ownerId: state.territories[territory.id]?.ownerId || null,
      armies: state.territories[territory.id]?.armies || 0,
      x: getMapPositions(state)[territory.id] ? getMapPositions(state)[territory.id].x : null,
      y: getMapPositions(state)[territory.id] ? getMapPositions(state)[territory.id].y : null
    })),
    continents: state.continents,
    mapVisual: {
      imageUrl: state.mapImageUrl || null,
      aspectRatio: state.mapAspectRatio || null
    },
    currentPlayerId: currentPlayer ? currentPlayer.id : null,
    reinforcementPool: state.reinforcementPool,
    winnerId: state.winnerId,
    gameConfig: state.gameConfig
      ? {
          ...state.gameConfig,
          mapName: state.gameConfig.mapName || readableMapName(typeof state.gameConfig.mapId === "string" ? state.gameConfig.mapId : null),
          pieceSkin: getPieceSkin(typeof state.gameConfig.pieceSkinId === "string" ? state.gameConfig.pieceSkinId : undefined)
        }
      : null,
    log: state.log,
    logEntries: state.logEntries,
    lastAction,
    lastCombat: lastAction && lastAction.type === GameAction.ATTACK ? lastAction.combat || null : null,
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
      currentPlayerMustTrade: currentPlayer && currentPlayer.id ? playerMustTradeCards(state, currentPlayer.id) : false
    }
  };
}

export function startGame(state: EngineState, random: () => number = secureRandom, now: Date = new Date()): void {
  if (!Array.isArray(state.players) || state.players.length === 0) {
    return;
  }

  const mapTerritories = getMapTerritories(state);
  const shuffledTerritories = shuffle(mapTerritories.map((territory) => territory.id), random);
  state.phase = "active";
  state.turnPhase = TurnPhase.REINFORCEMENT;
  state.turnStartedAt = null;
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
    if (!player || !player.id) {
      return;
    }

    player.surrendered = false;
    state.territories[territoryId] = { ownerId: player.id, armies: 1 };
  });

  const firstPlayer = getCurrentPlayer(state);
  if (!firstPlayer || !firstPlayer.id) {
    return;
  }

  state.reinforcementPool = computeReinforcements(state, firstPlayer.id);
  state.turnStartedAt = currentUtcTimestamp(now);
  appendLog(state, "Partita iniziata. Turno di " + firstPlayer.name + " con " + state.reinforcementPool + " rinforzi.", "game.log.gameStarted", {
    playerName: firstPlayer.name,
    reinforcementPool: state.reinforcementPool
  });
}

export function declareWinnerIfNeeded(state: EngineState): boolean {
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

export function advanceTurn(state: EngineState, now: Date = new Date()): void {
  if (state.winnerId || declareWinnerIfNeeded(state)) {
    return;
  }

  let nextIndex = state.currentTurnIndex;
  for (let step = 0; step < state.players.length; step += 1) {
    nextIndex = (nextIndex + 1) % state.players.length;
    const candidate = state.players[nextIndex];
    if (candidate && candidate.id && isPlayerAlive(state, candidate)) {
      state.currentTurnIndex = nextIndex;
      state.turnPhase = TurnPhase.REINFORCEMENT;
      state.reinforcementPool = computeReinforcements(state, candidate.id);
      state.turnStartedAt = currentUtcTimestamp(now);
      state.pendingConquest = null;
      state.fortifyUsed = false;
      state.conqueredTerritoryThisTurn = false;
      appendLog(state, "Nuovo turno: " + candidate.name + " riceve " + state.reinforcementPool + " rinforzi.", "game.log.turnStarted", {
        playerName: candidate.name,
        reinforcementPool: state.reinforcementPool
      });
      return;
    }
  }
}

export function addPlayer(state: EngineState, name: string, options: AddPlayerOptions = {}): AddPlayerResult {
  const normalizedName = String(name || "").trim().slice(0, 24);
  const linkedUserId = options.isAi ? null : (options.linkedUserId || null);
  const maxPlayers = Number.isInteger(state?.gameConfig?.totalPlayers) && (state.gameConfig?.totalPlayers || 0) > 0
    ? (state.gameConfig?.totalPlayers as number)
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
    color: palette[state.players.length % palette.length] as string,
    connected: true,
    isAi: Boolean(options.isAi),
    linkedUserId
  });
  state.players.push(player);
  appendLog(state, player.name + " entra nella lobby.", "game.log.playerJoined", { playerName: player.name });
  return { ok: true, player, rejoined: false };
}

export function applyReinforcement(
  state: EngineState,
  playerId: string,
  territoryId: string,
  requestedAmount: number = 1
): BasicResult {
  const territoryState = state.territories[territoryId];
  const player = getPlayer(state, playerId);
  const reinforcementAmount = Math.floor(Number(requestedAmount));

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state)?.id !== playerId) {
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

export function resolveAttack(
  state: EngineState,
  playerId: string,
  fromId: string,
  toId: string,
  random: () => number = secureRandom,
  requestedAttackDice: number | null = null
) {
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

  if (!getCurrentPlayer(state) || getCurrentPlayer(state)?.id !== playerId) {
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
  } else if (defenderLosses > 0) {
    summary += " Il difensore perde " + defenderLosses + " armata" + (defenderLosses > 1 ? "e" : "") + ".";
  } else {
    summary = attacker.name + " fallisce l'attacco su " + toId + ": " + attackRolls.join("-") + " contro " + defendRolls.join("-") + ".";
  }

  const combat: CombatSnapshot = {
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

export function moveAfterConquest(state: EngineState, playerId: string, armiesToMove: number): BasicResult {
  const player = getPlayer(state, playerId);
  const pending = state.pendingConquest;

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state)?.id !== playerId) {
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
  if (!from || !to) {
    return createActionFailure("Territori non validi.", "game.attack.invalidTerritories");
  }

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

export function applyFortify(
  state: EngineState,
  playerId: string,
  fromId: string,
  toId: string,
  armiesToMove: number
): BasicResult {
  const player = getPlayer(state, playerId);
  const from = state.territories[fromId];
  const to = state.territories[toId];

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state)?.id !== playerId) {
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

export function endTurn(state: EngineState, playerId: string) {
  const player = getPlayer(state, playerId);

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state)?.id !== playerId) {
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

  if (state.turnPhase === TurnPhase.ATTACK) {
    state.turnPhase = TurnPhase.FORTIFY;
    state.fortifyUsed = false;
    appendLog(state, player.name + " entra nella fase di fortifica.", "game.log.enterFortify", { playerName: player.name });
    return { ok: true, requiresFortifyDecision: true };
  }

  const awardedCard = awardTurnCardIfEligible(state, playerId);
  appendLog(state, player.name + " termina il turno.", "game.log.endTurn", { playerName: player.name });
  advanceTurn(state);
  return { ok: true, awardedCard };
}

export function forceEndTurn(
  state: EngineState,
  playerId: string,
  options: {
    reason?: "timeout" | "aiRecovery";
    turnTimeoutHours?: number | null;
    now?: Date;
  } = {}
) {
  const player = getPlayer(state, playerId);

  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state)?.id !== playerId) {
    return createActionFailure("Non e il tuo turno.", "game.notYourTurn");
  }

  if (state.pendingConquest) {
    const minArmies = Number((state.pendingConquest as PendingConquest).minArmies) || 1;
    const conquestResult = moveAfterConquest(state, playerId, minArmies);
    if (!conquestResult.ok) {
      return conquestResult;
    }
  }

  if (state.reinforcementPool > 0) {
    state.reinforcementPool = 0;
  }

  if (state.turnPhase === TurnPhase.REINFORCEMENT) {
    state.turnPhase = TurnPhase.ATTACK;
  }

  if (state.turnPhase === TurnPhase.ATTACK) {
    state.turnPhase = TurnPhase.FORTIFY;
    state.fortifyUsed = false;
  }

  const awardedCard = awardTurnCardIfEligible(state, playerId);
  const reason = options.reason || "timeout";
  const summary = reason === "timeout"
    ? player.name + " supera il limite turno e il sistema forza il passaggio del turno."
    : "Il turno AI di " + player.name + " si blocca e il sistema forza il passaggio del turno.";
  const summaryKey = reason === "timeout"
    ? "game.log.turnTimedOut"
    : "game.log.aiTurnRecovered";

  state.lastAction = {
    type: "forceEndTurn",
    summary,
    summaryKey,
    summaryParams: {
      playerName: player.name,
      turnTimeoutHours: options.turnTimeoutHours || null
    },
    playerId
  };
  appendLog(
    state,
    summary,
    summaryKey,
    {
      playerName: player.name,
      turnTimeoutHours: options.turnTimeoutHours || null
    }
  );
  advanceTurn(state, options.now);
  return { ok: true, awardedCard, forced: true };
}

export function surrenderPlayer(state: EngineState, playerId: string) {
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
