import { attackSuccessProbability, territoryPriority } from "./ai.js";
import {
  REINFORCE,
  ATTACK,
  FORTIFY,
  GAME_OVER,
} from "./phases.js";
import { colorPalette } from "./colors.js";
import EventBus from "./src/core/event-bus.js";

async function loadMapData() {
  try {
    if (typeof fetch === "function") {
      const res = await fetch("./src/data/map.json");
      if (res.ok) return await res.json();
    }
    const fs = await import("fs/promises");
    const pathMod = await import("path");
    const filePath = pathMod.resolve("src/data/map.json");
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { territories: [], continents: [], deck: [] };
  }
}

class Game {
  constructor(players, territories = [], continents = [], deck = [], shuffleDeck = true) {
    this.players =
      players || [
        { name: 'Player 1', color: colorPalette[0] },
        { name: 'Player 2', color: colorPalette[1] },
        { name: 'AI', color: colorPalette[2], ai: true },
      ];

    this.events = new EventBus();

    const total = territories.length || 1;
    territories = territories.map((t, i) => ({
      id: t.id,
      neighbors: t.neighbors,
      x: t.x,
      y: t.y,
      owner:
        typeof t.owner === "number"
          ? t.owner
          : Math.floor((i * this.players.length) / total),
      armies: t.armies || 3,
    }));

    this.territories = territories;
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
  }

  static async create(players, territories, continents, deck) {
    if (territories && continents && deck) {
      return new Game(players, territories, continents, deck);
    }
    const map = await loadMapData();
    return new Game(
      players,
      territories || map.territories,
      continents || map.continents,
      deck || map.deck
    );
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

  handleTerritoryClick(id) {
    const territory = this.territoryById(id);
    if (!territory) return null;

    if (this.phase === REINFORCE) {
      if (territory.owner === this.currentPlayer && this.reinforcements > 0) {
        territory.armies += 1;
        this.reinforcements -= 1;
        this.emit(REINFORCE, { territory: id, player: this.currentPlayer });
        if (this.reinforcements === 0) {
          this.phase = ATTACK;
          this.emit('phaseChange', { phase: this.phase, player: this.currentPlayer });
        }
        return { type: REINFORCE, territory: id };
      }
    } else if (this.phase === ATTACK) {
      if (!this.selectedFrom) {
        if (territory.owner === this.currentPlayer && territory.armies > 1) {
          this.selectedFrom = territory;
          return { type: 'select', territory: id };
        }
      } else {
        const from = this.selectedFrom;
        const to = territory;
        if (from.id === to.id) {
          this.selectedFrom = null;
          return { type: 'deselect', territory: id };
        }
        if (from.owner === this.currentPlayer && to.owner !== this.currentPlayer && from.neighbors.includes(to.id)) {
          const result = this.attack(from, to);
          this.emit(ATTACK, { from: from.id, to: to.id, result });
          this.selectedFrom = null;
          return Object.assign({ type: ATTACK, from: from.id, to: to.id }, result);
        }
      }
    } else if (this.phase === FORTIFY) {
      if (!this.selectedFrom) {
        if (territory.owner === this.currentPlayer && territory.armies > 1) {
          this.selectedFrom = territory;
          return { type: 'select', territory: id };
        }
      } else {
        const from = this.selectedFrom;
        const to = territory;
        if (from.id === to.id) {
          this.selectedFrom = null;
          return { type: 'deselect', territory: id };
        }
        if (
          from.owner === this.currentPlayer &&
          to.owner === this.currentPlayer &&
          from.neighbors.includes(to.id)
        ) {
          const movable = from.armies - 1;
          this.selectedFrom = null;
          return { type: FORTIFY, from: from.id, to: to.id, movableArmies: movable };
        }
      }
    }
    return null;
  }

  attack(from, to) {
    const attackDice = Math.min(3, from.armies - 1);
    const defendDice = Math.min(2, to.armies);

    const attackRolls = Array.from({ length: attackDice }, () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a);
    const defendRolls = Array.from({ length: defendDice }, () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a);

    const comparisons = Math.min(attackRolls.length, defendRolls.length);
    for (let i = 0; i < comparisons; i++) {
      if (attackRolls[i] > defendRolls[i]) {
        to.armies -= 1;
      } else {
        from.armies -= 1;
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
    const result = { attackRolls, defendRolls, conquered, movableArmies };
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
    from.armies -= count;
    to.armies += count;
    this.emit('move', { from: fromId, to: toId, count });
    return true;
  }

  checkVictory() {
    const owner = this.territories[0].owner;
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
      this.emit('turnStart', { player: this.currentPlayer });
      this.emit('phaseChange', { phase: this.phase, player: this.currentPlayer });
    }
  }

  drawCard(player) {
    if (this.deck.length === 0) return null;
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

  performAITurn() {
    if (!this.players[this.currentPlayer].ai || this.phase === GAME_OVER) return;
    // Play cards if possible
    const hand = this.hands[this.currentPlayer];
    const set = this.findValidSet(hand);
    if (set) this.playCards(set);

    // Reinforce prioritizing territories
    while (this.reinforcements > 0) {
      const owned = this.territories.filter(t => t.owner === this.currentPlayer);
      if (owned.length === 0) break;
      const target = owned.reduce((best, t) => {
        const score = territoryPriority(this, t);
        return !best || score > best.score ? { t, score } : best;
      }, null).t;
      target.armies += 1;
      this.reinforcements -= 1;
    }
    if (this.phase === REINFORCE && this.reinforcements === 0) {
      this.phase = ATTACK;
    }

    // Attack while probabilities favorable
    while (this.phase === ATTACK) {
      const options = [];
      this.territories
        .filter(t => t.owner === this.currentPlayer && t.armies > 1)
        .forEach(from => {
          from.neighbors.forEach(n => {
            const to = this.territoryById(n);
            if (to.owner !== this.currentPlayer) {
              const prob = attackSuccessProbability(from, to);
              options.push({ from, to, prob });
            }
          });
        });
      if (options.length === 0) break;
      options.sort((a, b) => b.prob - a.prob);
      const best = options[0];
      if (best.prob < 0.6) break;
      this.attack(best.from, best.to);
      if (this.phase === GAME_OVER) return;
    }

    // Fortify one army from strong to weak border
    this.endTurn();
    if (this.phase === FORTIFY) {
      let best = null;
      const aiOwned = this.territories.filter(t => t.owner === this.currentPlayer);
      aiOwned.forEach(from => {
        if (from.armies > 1) {
          from.neighbors.forEach(n => {
            const to = this.territoryById(n);
            if (to.owner === this.currentPlayer) {
              const diff = territoryPriority(this, to) - territoryPriority(this, from);
              if (!best || diff > best.diff) best = { from, to, diff };
            }
          });
        }
      });
      if (best && best.diff > 0) {
        this.moveArmies(best.from.id, best.to.id, 1);
      }
      this.endTurn();
    }
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
