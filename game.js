class Game {
  constructor(players, territories) {
    this.players = players || [
      { name: 'Player 1', color: '#e74c3c' },
      { name: 'Player 2', color: '#3498db' },
      { name: 'AI', color: '#2ecc71', ai: true }
    ];
    this.territories = territories || [
      { id: 't1', neighbors: ['t2', 't4'], owner: 0, armies: 3 },
      { id: 't2', neighbors: ['t1', 't3', 't5'], owner: 0, armies: 3 },
      { id: 't3', neighbors: ['t2', 't6'], owner: 1, armies: 3 },
      { id: 't4', neighbors: ['t1', 't5'], owner: 1, armies: 3 },
      { id: 't5', neighbors: ['t2', 't4', 't6'], owner: 2, armies: 3 },
      { id: 't6', neighbors: ['t3', 't5'], owner: 2, armies: 3 }
    ];
    this.currentPlayer = 0;
    this.phase = 'reinforce';
    this.selectedFrom = null;
    this.reinforcements = 0;
    this.calculateReinforcements();
  }

  calculateReinforcements() {
    const owned = this.territories.filter(t => t.owner === this.currentPlayer).length;
    this.reinforcements = Math.max(3, Math.floor(owned / 3));
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
      this.selectedFrom = null;
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
      this.phase = 'reinforce';
      this.calculateReinforcements();
    }
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
    // Attempt a single random attack
    const options = [];
    owned.forEach(from => {
      if (from.armies > 1) {
        from.neighbors.forEach(n => {
          const to = this.territoryById(n);
          if (to.owner !== this.currentPlayer) options.push({ from, to });
        });
      }
    });
    if (options.length > 0) {
      const { from, to } = options[Math.floor(Math.random() * options.length)];
      this.attack(from, to);
    }
    // End turn
    this.endTurn();
    if (this.phase === 'fortify') this.endTurn();
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
