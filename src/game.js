/* global logger */
import {
  REINFORCE,
  ATTACK,
  FORTIFY,
  GAME_OVER,
} from "./phases.js";
import { IS_TEST } from "./config.js";
import { colorPalette } from "./colors.js";
import EventBus from "./core/event-bus.js";
import loadJson from "./utils/load-json.js";

async function loadMapData() {
  const mapName =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("netriskMap")) ||
    "map";
  const jsonPath = `./src/data/${mapName}.json`;
  try {
    return await loadJson(jsonPath);
  } catch (err) {
    const msg = `Failed to load map data from ${jsonPath}`;
    if (typeof logger !== "undefined") {
      logger.error(msg, err);
    } else {
      console.error(msg, err);
    }
    throw new Error(`Map data file not found: ${jsonPath}`);
  }
}

class Game {
  constructor(
    players,
    territories = [],
    continents = [],
    deck = [],
    shuffleDeck = true,
    randomizeTerritories = true,
    maxUndoSteps = 10,
  ) {
    this.players =
      players || [
        { name: 'Player 1', color: colorPalette[0] },
        { name: 'Player 2', color: colorPalette[1] },
        { name: 'AI', color: colorPalette[2], ai: true },
      ];

    this.events = new EventBus();

    if (IS_TEST) {
      randomizeTerritories = false;
    }

    const total = territories.length || 1;
    let owners = Array.from({ length: total }, (_, i) =>
      Math.floor((i * this.players.length) / total),
    );
    if (randomizeTerritories) this.shuffle(owners);
    territories = territories.map((t, i) => ({
      id: t.id,
      neighbors: t.neighbors,
      x: t.x,
      y: t.y,
      owner: typeof t.owner === "number" ? t.owner : owners[i],
      armies: t.armies || 3,
    }));

    this.territories = territories;
    if (this.players.length) {
      const lastPlayer = this.players.length - 1;
      const lastOwned = this.territories.filter((t) => t.owner === lastPlayer);
      if (lastOwned.length > 0) {
        const extra = lastOwned[Math.floor(Math.random() * lastOwned.length)];
        extra.armies += 1;
      }
    }
    this.currentPlayer = 0;
    this.phase = REINFORCE;
    this.selectedFrom = null;
    this.reinforcements = 0;
    this.continents = continents;
    this.deck = (deck || []).map((c) => ({ ...c }));
    if (shuffleDeck) this.shuffle(this.deck);
    this.hands = Array.from({ length: this.players.length }, () => []);
    this.discard = [];
    this.conqueredThisTurn = false;
    this.calculateReinforcements();

    this.phaseHandlers = {
      [REINFORCE]: this.handleReinforcePhase.bind(this),
      [ATTACK]: this.handleAttackPhase.bind(this),
      [FORTIFY]: this.handleFortifyPhase.bind(this),
    };

    this.maxUndo = maxUndoSteps;
    this.undoStack = [];
    this.redoStack = [];
  }

  static async create(players, territories, continents, deck, maxUndoSteps) {
    if (territories && continents && deck) {
      return new Game(players, territories, continents, deck, true, true, maxUndoSteps);
    }
    try {
      const map = await loadMapData();
      return new Game(
        players,
        territories || map.territories,
        continents || map.continents,
        deck || map.deck,
        true,
        true,
        maxUndoSteps
      );
    } catch (err) {
      console.error("Unable to load map data, starting with empty map.", err);
      if (typeof alert === "function") {
        try {
          alert("Unable to load map data. Starting with empty map.");
        } catch (alertErr) {
          // In non-browser environments alert may not be available
          console.error("Failed to display alert", alertErr);
        }
      }
      return new Game(
        players,
        territories || [],
        continents || [],
        deck || [],
        true,
        true,
        maxUndoSteps
      );
    }
  }

  calculateReinforcements() {
    const owned = this.territories.filter(t => t.owner === this.currentPlayer).length;
    let reinf = Math.max(3, Math.floor(owned / 3));
    this.continents.forEach(c => {
      if (
        c.territories.every(id => {
          const terr = this.territoryById(id);
          return terr && terr.owner === this.currentPlayer;
        })
      ) {
        reinf += c.bonus;
      }
    });
    this.reinforcements = reinf;
    this.emit('reinforcementsCalculated', {
      player: this.currentPlayer,
      amount: this.reinforcements,
    });
  }

  territoryById(id) {
    return this.territories.find(t => t.id === id);
  }

  processSelection(action, territory) {
    const id = territory.id;
    if (action.direct) {
      if (!action.canSelect || action.canSelect(territory)) {
        return action.onSelect ? action.onSelect.call(this, territory) : null;
      }
      return null;
    }
    if (!this.selectedFrom) {
      if (!action.canSelect || action.canSelect(territory)) {
        this.pushUndoState();
        this.selectedFrom = territory;
        return { type: 'select', territory: id };
      }
    } else {
      const from = this.selectedFrom;
      const to = territory;
      if (from.id === to.id) {
        this.pushUndoState();
        this.selectedFrom = null;
        return { type: 'deselect', territory: id };
      }
      if (!action.canMove || action.canMove(from, to)) {
        this.selectedFrom = null;
        return action.onMove ? action.onMove.call(this, from, to) : null;
      }
    }
    return null;
  }

  handleReinforcePhase(territory) {
    return this.processSelection(
      {
        direct: true,
        canSelect: (t) =>
          t.owner === this.currentPlayer && this.reinforcements > 0,
        onSelect: (t) => {
          this.pushUndoState();
          t.armies += 1;
          this.reinforcements -= 1;
          this.emit(REINFORCE, {
            territory: t.id,
            player: this.currentPlayer,
          });
          if (this.reinforcements === 0) {
            this.phase = ATTACK;
            this.emit('phaseChange', {
              phase: this.phase,
              player: this.currentPlayer,
            });
          }
          return { type: REINFORCE, territory: t.id };
        },
      },
      territory,
    );
  }

  handleAttackPhase(territory) {
    return this.processSelection(
      {
        canSelect: (t) =>
          t.owner === this.currentPlayer && t.armies > 1,
        canMove: (from, to) =>
          from.owner === this.currentPlayer &&
          to.owner !== this.currentPlayer &&
          from.neighbors.includes(to.id),
        onMove: (from, to) => {
          const result = this.attack(from, to);
          this.emit(ATTACK, { from: from.id, to: to.id, result });
          return Object.assign({ type: ATTACK, from: from.id, to: to.id }, result);
        },
      },
      territory,
    );
  }

  handleFortifyPhase(territory) {
    return this.processSelection(
      {
        canSelect: (t) =>
          t.owner === this.currentPlayer && t.armies > 1,
        canMove: (from, to) =>
          from.owner === this.currentPlayer &&
          to.owner === this.currentPlayer &&
          from.neighbors.includes(to.id),
        onMove: (from, to) => {
          const movable = from.armies - 1;
          return {
            type: FORTIFY,
            from: from.id,
            to: to.id,
            movableArmies: movable,
          };
        },
      },
      territory,
    );
  }

  handleTerritoryClick(id) {
    const territory = this.territoryById(id);
    if (!territory) return null;

    const handler = this.phaseHandlers[this.phase];
    return handler ? handler(territory) : null;
  }

  attack(from, to) {
    const attackDice = Math.min(3, from.armies - 1);
    const defendDice = Math.min(2, to.armies);

    const attackRolls = Array.from({ length: attackDice }, () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a);
    const defendRolls = Array.from({ length: defendDice }, () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a);

    const comparisons = Math.min(attackRolls.length, defendRolls.length);
    let attackerLosses = 0;
    let defenderLosses = 0;
    for (let i = 0; i < comparisons; i++) {
      if (attackRolls[i] > defendRolls[i]) {
        to.armies -= 1;
        defenderLosses += 1;
      } else {
        from.armies -= 1;
        attackerLosses += 1;
      }
    }

    let conquered = false;
    let movableArmies = 0;
    if (to.armies <= 0) {
      to.owner = from.owner;
      to.armies = 1;
      from.armies -= 1; // mandatory move
      conquered = true;
      movableArmies = from.armies - 1;
      this.conqueredThisTurn = true;
      this.checkVictory();
    }
    const result = { attackRolls, defendRolls, conquered, movableArmies, attackerLosses, defenderLosses };
    this.emit('attackResolved', { from: from.id, to: to.id, result });
    return result;
  }

  moveArmies(fromId, toId, count) {
    const from = this.territoryById(fromId);
    const to = this.territoryById(toId);
    if (!from || !to) return false;
    if (from.owner !== this.currentPlayer || to.owner !== this.currentPlayer) return false;
    if (!from.neighbors.includes(to.id)) return false;
    if (count < 1 || from.armies <= count) return false;
    this.pushUndoState();
    from.armies -= count;
    to.armies += count;
    this.emit('move', { from: fromId, to: toId, count });
    return true;
  }

  pushUndoState() {
    this.undoStack.push(this.serialize());
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  restoreState(stateStr) {
    const data = JSON.parse(stateStr);
    this.players = data.players;
    this.territories = data.territories;
    this.continents = data.continents;
    this.deck = data.deck;
    this.hands = data.hands;
    this.discard = data.discard || [];
    this.currentPlayer = data.currentPlayer;
    this.phase = data.phase;
    this.reinforcements = data.reinforcements;
    this.selectedFrom =
      data.selectedFrom != null ? this.territoryById(data.selectedFrom) : null;
    this.conqueredThisTurn = data.conqueredThisTurn || false;
    this.winner = data.winner;
  }

  undo() {
    if (!this.canUndo()) return false;
    const prev = this.undoStack.pop();
    this.redoStack.push(this.serialize());
    this.restoreState(prev);
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const next = this.redoStack.pop();
    this.undoStack.push(this.serialize());
    this.restoreState(next);
    return true;
  }

  checkVictory() {
    if (this.territories.length === 0) return null;
    const owner = this.territories[0].owner;
    if (owner === undefined) return null;
    const win = this.territories.every(t => t.owner === owner);
    if (win) {
      this.phase = GAME_OVER;
      this.winner = owner;
      return owner;
    }
    return null;
  }

  endTurn() {
    if (this.phase === GAME_OVER) return;
    if (this.phase === ATTACK) {
      this.selectedFrom = null;
      this.phase = FORTIFY;
      this.emit('phaseChange', { phase: this.phase, player: this.currentPlayer });
    } else if (this.phase === FORTIFY) {
      const prev = this.currentPlayer;
      this.selectedFrom = null;
      this.undoStack = [];
      this.redoStack = [];
      // Move to the next player, skipping any who have been eliminated
      do {
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
      } while (!this.territories.some(t => t.owner === this.currentPlayer));
      if (this.conqueredThisTurn) {
        const card = this.drawCard(prev);
        this.conqueredThisTurn = false;
        if (card) {
          this.emit('cardAwarded', { player: prev, card });
        }
      }
      this.phase = REINFORCE;
      this.calculateReinforcements();
      while (this.hands[this.currentPlayer].length > 5) {
        const set = this.findValidSet(this.hands[this.currentPlayer]);
        if (!set) break;
        this.playCards(set);
      }
      this.emit('turnStart', { player: this.currentPlayer });
      this.emit('phaseChange', { phase: this.phase, player: this.currentPlayer });
    }
  }

  drawCard(player) {
    if (this.deck.length === 0) {
      if (this.discard.length === 0) return null;
      this.shuffle(this.discard);
      this.deck = this.discard;
      this.discard = [];
    }
    const card = this.deck.shift();
    this.hands[player].push(card);
    this.emit('cardDrawn', { player, card });
    return card;
  }

  playCards(indices) {
    const hand = this.hands[this.currentPlayer];
    if (indices.length !== 3) return false;
    const cards = indices.map(i => hand[i]);
    if (cards.some(c => !c)) return false;
    const types = cards.map(c => c.type);
    const allSame = types.every(t => t === types[0]);
    const allDiff = new Set(types).size === 3;
    if (!allSame && !allDiff) return false;
    indices.sort((a, b) => b - a).forEach(i => this.discard.push(hand.splice(i, 1)[0]));
    this.reinforcements += 5;
    this.emit('cardsPlayed', { player: this.currentPlayer, cards });
    return true;
  }

  findValidSet(hand) {
    for (let i = 0; i < hand.length - 2; i++) {
      for (let j = i + 1; j < hand.length - 1; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          const types = [hand[i].type, hand[j].type, hand[k].type];
          const allSame = types.every(t => t === types[0]);
          const allDiff = new Set(types).size === 3;
          if (allSame || allDiff) return [i, j, k];
        }
      }
    }
    return null;
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  serialize() {
    return JSON.stringify({
      players: this.players,
      territories: this.territories,
      continents: this.continents,
      deck: this.deck,
      hands: this.hands,
      discard: this.discard,
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      reinforcements: this.reinforcements,
      selectedFrom: this.selectedFrom ? this.selectedFrom.id : null,
      conqueredThisTurn: this.conqueredThisTurn,
      winner: this.winner,
    });
  }

  static deserialize(str) {
    const data = typeof str === 'string' ? JSON.parse(str) : str;
    const game = new Game(
      data.players,
      data.territories,
      data.continents,
      data.deck,
      false
    );
    game.hands = data.hands;
    game.discard = data.discard || [];
    game.currentPlayer = data.currentPlayer;
    game.phase = data.phase;
    game.reinforcements = data.reinforcements;
    game.selectedFrom = data.selectedFrom ? game.territoryById(data.selectedFrom) : null;
    game.conqueredThisTurn = data.conqueredThisTurn || false;
    game.winner = data.winner;
    return game;
  }

  getPhase() { return this.phase; }
  setPhase(p) { this.phase = p; }
  getCurrentPlayer() { return this.currentPlayer; }
  setCurrentPlayer(p) { this.currentPlayer = p; }
  getSelectedFrom() { return this.selectedFrom; }
  setSelectedFrom(s) { this.selectedFrom = s; }

  on(event, handler) {
    return this.events.on(event, handler);
  }

  off(event, handler) {
    this.events.off(event, handler);
  }

  emit(event, payload) {
    this.events.emit(event, payload);
  }

  use(plugin) {
    if (typeof plugin === 'function') {
      plugin(this);
    }
  }
}

export default Game;
