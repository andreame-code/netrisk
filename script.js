const players = [
  { name: 'Player 1', color: '#e74c3c' },
  { name: 'Player 2', color: '#3498db' }
];

const territories = [
  { id: 't1', neighbors: ['t2', 't4'], owner: 0, armies: 3 },
  { id: 't2', neighbors: ['t1', 't3', 't5'], owner: 0, armies: 3 },
  { id: 't3', neighbors: ['t2', 't6'], owner: 0, armies: 3 },
  { id: 't4', neighbors: ['t1', 't5'], owner: 1, armies: 3 },
  { id: 't5', neighbors: ['t2', 't4', 't6'], owner: 1, armies: 3 },
  { id: 't6', neighbors: ['t3', 't5'], owner: 1, armies: 3 }
];

let currentPlayer = 0;
let phase = 'reinforce'; // reinforce, attack, gameover
let selectedFrom = null;

function updateUI() {
  territories.forEach(t => {
    const el = document.getElementById(t.id);
    el.style.background = players[t.owner].color;
    el.textContent = t.armies;
    el.classList.remove('selected');
  });
  document.getElementById('status').textContent = `${players[currentPlayer].name} - ${phase}`;
}

function territoryById(id) {
  return territories.find(t => t.id === id);
}

function handleTerritoryClick(e) {
  const id = e.currentTarget.dataset.id;
  const territory = territoryById(id);
  if (phase === 'reinforce') {
    if (territory.owner === currentPlayer) {
      territory.armies += 1;
      phase = 'attack';
      updateUI();
    }
  } else if (phase === 'attack') {
    if (!selectedFrom) {
      if (territory.owner === currentPlayer && territory.armies > 1) {
        selectedFrom = territory;
        e.currentTarget.classList.add('selected');
      }
    } else {
      const from = selectedFrom;
      const to = territory;
      if (from.id === to.id) {
        // deselect
        selectedFrom = null;
        updateUI();
        return;
      }
      if (from.owner === currentPlayer && to.owner !== currentPlayer && from.neighbors.includes(to.id)) {
        attack(from, to);
        selectedFrom = null;
        updateUI();
      }
    }
  }
}

function attack(from, to) {
  const attackRoll = Math.ceil(Math.random()*6);
  const defendRoll = Math.ceil(Math.random()*6);
  if (attackRoll > defendRoll) {
    to.armies -= 1;
    if (to.armies <= 0) {
      to.owner = from.owner;
      to.armies = 1;
      from.armies -= 1;
      checkVictory();
    }
  } else {
    from.armies -= 1;
  }
}

function checkVictory() {
  const owner = territories[0].owner;
  const win = territories.every(t => t.owner === owner);
  if (win) {
    phase = 'gameover';
    document.getElementById('status').textContent = `${players[owner].name} wins!`;
  }
}

function endTurn() {
  if (phase === 'gameover') return;
  selectedFrom = null;
  currentPlayer = (currentPlayer + 1) % players.length;
  phase = 'reinforce';
  updateUI();
}

document.querySelectorAll('.territory').forEach(el => {
  el.addEventListener('click', handleTerritoryClick);
});

document.getElementById('endTurn').addEventListener('click', endTurn);

updateUI();
if (typeof module !== 'undefined') {
  module.exports = {
    players,
    territories,
    updateUI,
    territoryById,
    handleTerritoryClick,
    attack,
    checkVictory,
    endTurn,
    getPhase: () => phase,
    setPhase: (p) => { phase = p; },
    getCurrentPlayer: () => currentPlayer,
    setCurrentPlayer: (p) => { currentPlayer = p; },
    getSelectedFrom: () => selectedFrom,
    setSelectedFrom: (s) => { selectedFrom = s; }
  };
}
