const Game = typeof window !== 'undefined' && window.Game ? window.Game : require('./game');
const game = new Game();

const territoryPositions = {
  t1: { x: 120, y: 100 },
  t2: { x: 340, y: 110 },
  t3: { x: 500, y: 140 },
  t4: { x: 150, y: 260 },
  t5: { x: 360, y: 220 },
  t6: { x: 520, y: 300 }
};

let audioCtx;
function playTone(freq, duration = 0.2) {
  if (typeof window === 'undefined') return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!audioCtx) audioCtx = new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

function playAttackSound() { playTone(300); }
function playConquerSound() { playTone(600, 0.3); }

function updateUI() {
  game.territories.forEach(t => {
    const el = document.getElementById(t.id);
    el.style.background = game.players[t.owner].color;
    el.textContent = t.armies;
    const pos = territoryPositions[t.id];
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.classList.remove('selected');
  });
  let status = `${game.players[game.currentPlayer].name} - ${game.getPhase()}`;
  if (game.getPhase() === 'reinforce') {
    status += ` (${game.reinforcements} reinforcements)`;
  }
  document.getElementById('status').textContent = status;
}

document.querySelectorAll('.territory').forEach(el => {
  el.addEventListener('click', () => {
    const result = game.handleTerritoryClick(el.dataset.id);
    if (result) {
      if (result.type === 'attack') {
        playAttackSound();
        const fromEl = document.getElementById(result.from);
        const toEl = document.getElementById(result.to);
        fromEl.classList.add('attack');
        toEl.classList.add('attack');
        setTimeout(() => {
          fromEl.classList.remove('attack');
          toEl.classList.remove('attack');
        }, 500);
        document.getElementById('diceResults').textContent = `Attacker: ${result.attackRolls.join(', ')} | Defender: ${result.defendRolls.join(', ')}`;
        if (result.conquered) {
          playConquerSound();
          toEl.classList.add('conquer');
          setTimeout(() => toEl.classList.remove('conquer'), 1000);
        }
      }
    }
    updateUI();
    if (result && result.type === 'select') {
      document.getElementById(result.territory).classList.add('selected');
    }
  });
});

document.getElementById('endTurn').addEventListener('click', () => {
  game.endTurn();
  updateUI();
});

updateUI();

if (typeof module !== 'undefined') {
  module.exports = { game, updateUI, territoryPositions };
}
