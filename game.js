class Game {
  constructor(players, territories) {
    this.players = players || [
      { name: 'Player 1', color: '#e74c3c' },
      { name: 'Player 2', color: '#3498db' },
      { name: 'AI', color: '#2ecc71', ai: true }
    ];

    if (!territories) {
      try {
        // Load default territory data from JSON when none provided
        const map = require('./src/data/map.json');
        territories = map.territories.map((t, i) => ({
          id: t.id,
          neighbors: t.neighbors,
          x: t.x,
          y: t.y,
          owner: Math.floor((i * this.players.length) / map.territories.length),
          armies: 3,
        }));
      } catch (err) {
        territories = [];
      }
    } else {
      territories = territories.map((t, i) => ({
        id: t.id,
        neighbors: t.neighbors,
        x: t.x,
        y: t.y,
        owner:
          typeof t.owner === 'number'
            ? t.owner
            : Math.floor((i * this.players.length) / territories.length),
        armies: t.armies || 3,
      }));
    }

    this.territories = territories;
    this.currentPlayer = 0;
    this.phase = 'reinforce';
    this.selectedFrom = null;
    this.reinforcements = 0;
    this.continents = [
      { name: 'north', territories: ['t1', 't2', 't3'], bonus: 2 },
      { name: 'south', territories: ['t4', 't5', 't6'], bonus: 2 }
    ];
    this.deck = [
      { territory: 't1', type: 'infantry' },
      { territory: 't2', type: 'cavalry' },
      { territory: 't3', type: 'artillery' },
      { territory: 't4', type: 'infantry' },
      { territory: 't5', type: 'cavalry' },
      { territory: 't6', type: 'artillery' }
    ];
    this.shuffle(this.deck);
    this.hands = Array.from({ length: this.players.length }, () => []);
    this.discard = [];
    this.conqueredThisTurn = false;
    this.calculateReinforcements();
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
  }

  territoryById(id) {
    return this.territories.find(t => t.id === id);
  }

  handleTerritoryClick(id) {
    const territory = this.territoryById(id);
    if (!territory) return null;

    if (this.phase === 'reinforce') {
      if (territory.owner === this.currentPlayer && this.reinforcements > 0) {
        territory.armies += 1;
        this.reinforcements -= 1;
        if (this.reinforcements === 0) {
          this.phase = 'attack';
        }
        return { type: 'reinforce', territory: id };
      }
    } else if (this.phase === 'attack') {
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
          this.selectedFrom = null;
          return Object.assign({ type: 'attack', from: from.id, to: to.id }, result);
        }
      }
    } else if (this.phase === 'fortify') {
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
        if (from.owner === this.currentPlayer && to.owner === this.currentPlayer && from.neighbors.includes(to.id)) {
          from.armies -= 1;
          to.armies += 1;
          this.selectedFrom = null;
          this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
          this.phase = 'reinforce';
          this.calculateReinforcements();
          return { type: 'fortify', from: from.id, to: to.id };
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
    if (to.armies <= 0) {
      to.owner = from.owner;
      to.armies = 1;
      from.armies -= 1;
      conquered = true;
      this.conqueredThisTurn = true;
      this.checkVictory();
    }
    return { attackRolls, defendRolls, conquered };
  }

  checkVictory() {
    const owner = this.territories[0].owner;
    const win = this.territories.every(t => t.owner === owner);
    if (win) {
      this.phase = 'gameover';
      this.winner = owner;
      return owner;
    }
    return null;
  }

  endTurn() {
    if (this.phase === 'gameover') return;
    if (this.phase === 'attack') {
      this.selectedFrom = null;
      this.phase = 'fortify';
    } else if (this.phase === 'fortify') {
      const prev = this.currentPlayer;
      this.selectedFrom = null;
      // Move to the next player, skipping any who have been eliminated
      do {
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
      } while (!this.territories.some(t => t.owner === this.currentPlayer));
      if (this.conqueredThisTurn) {
        this.drawCard(prev);
        this.conqueredThisTurn = false;
      }
      this.phase = 'reinforce';
      this.calculateReinforcements();
    }
  }

  drawCard(player) {
    if (this.deck.length === 0) return null;
    const card = this.deck.shift();
    this.hands[player].push(card);
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
    return true;
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  performAITurn() {
    if (!this.players[this.currentPlayer].ai || this.phase === 'gameover') return;
    // Reinforce randomly
    const owned = this.territories.filter(t => t.owner === this.currentPlayer);
    while (this.reinforcements > 0 && owned.length > 0) {
      const t = owned[Math.floor(Math.random() * owned.length)];
      t.armies += 1;
      this.reinforcements -= 1;
    }
    if (this.phase === 'reinforce' && this.reinforcements === 0) {
      this.phase = 'attack';
    }
    // Keep attacking while advantageous targets exist
    while (this.phase === 'attack') {
      const options = [];
      this.territories
        .filter(t => t.owner === this.currentPlayer)
        .forEach(from => {
          if (from.armies > 1) {
            from.neighbors.forEach(n => {
              const to = this.territoryById(n);
              if (to.owner !== this.currentPlayer && from.armies > to.armies) {
                options.push({ from, to });
              }
            });
          }
        });
      if (options.length === 0) break;
      const { from, to } = options[Math.floor(Math.random() * options.length)];
      this.attack(from, to);
      if (this.phase === 'gameover') return;
    }
    // Move to fortify phase and automatically fortify one army
    this.endTurn();
    if (this.phase === 'fortify') {
      const aiOwned = this.territories.filter(t => t.owner === this.currentPlayer);
      let best = null;
      aiOwned.forEach(from => {
        if (from.armies > 1) {
          from.neighbors.forEach(n => {
            const to = this.territoryById(n);
            if (to.owner === this.currentPlayer) {
              const diff = from.armies - to.armies;
              if (diff > 1 && (!best || diff > best.diff)) {
                best = { from, to, diff };
              }
            }
          });
        }
      });
      if (best) {
        best.from.armies -= 1;
        best.to.armies += 1;
      }
      this.endTurn();
    }
  }

  getPhase() { return this.phase; }
  setPhase(p) { this.phase = p; }
  getCurrentPlayer() { return this.currentPlayer; }
  setCurrentPlayer(p) { this.currentPlayer = p; }
  getSelectedFrom() { return this.selectedFrom; }
  setSelectedFrom(s) { this.selectedFrom = s; }
}

if (typeof module !== 'undefined') {
  module.exports = Game;
} else {
  window.Game = Game;
}
