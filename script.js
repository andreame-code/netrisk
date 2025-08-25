/* global logger */
// Remove any previously registered service workers to avoid stale caches
if (typeof navigator !== "undefined" && navigator.serviceWorker) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()));
}

const Game =
  typeof window !== "undefined" && window.Game
    ? window.Game
    : require("./game");
const game = new Game();
if (typeof logger !== "undefined") {
  logger.info("Game initialised");
}

const gameState = {
  turnNumber: 1,
  currentPlayer: game.currentPlayer,
  players: game.players,
  territories: game.territories,
  selectedTerritory: null,
  tokenPosition: null,
  phase: game.getPhase(),
  log: [],
};

function updateGameState(selected = null) {
  gameState.currentPlayer = game.currentPlayer;
  gameState.players = game.players;
  gameState.territories = game.territories;
  gameState.phase = game.getPhase();
  gameState.selectedTerritory = selected;
  gameState.tokenPosition = selected ? territoryPositions[selected] : null;
}

function updateInfoPanel() {
  const cp = document.getElementById("currentPlayer");
  if (cp) cp.textContent = game.players[gameState.currentPlayer].name;
  const tn = document.getElementById("turnNumber");
  if (tn) tn.textContent = gameState.turnNumber;
}

function addLogEntry(msg) {
  gameState.log.push(msg);
  if (gameState.log.length > 10) gameState.log.shift();
  const logEl = document.getElementById("actionLog");
  if (logEl) {
    logEl.innerHTML = gameState.log.map((l) => `<div>${l}</div>`).join("");
    logEl.scrollTop = logEl.scrollHeight;
  }
}

const territoryPositions = {
  t1: { x: 120, y: 100 },
  t2: { x: 340, y: 110 },
  t3: { x: 500, y: 140 },
  t4: { x: 150, y: 260 },
  t5: { x: 360, y: 220 },
  t6: { x: 520, y: 300 },
};

let audioCtx;
function playTone(freq, duration = 0.2) {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!audioCtx) audioCtx = new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioCtx.currentTime + duration,
  );
  osc.stop(audioCtx.currentTime + duration);
}

function playAttackSound() {
  playTone(300);
}
function playConquerSound() {
  playTone(600, 0.3);
}

function updateUI() {
  game.territories.forEach((t) => {
    const el = document.getElementById(t.id);
    el.style.background = game.players[t.owner].color;
    el.textContent = t.armies;
    const pos = territoryPositions[t.id];
    el.style.left = pos.x + "px";
    el.style.top = pos.y + "px";
    el.classList.remove("selected");
  });
  let status = `${game.players[game.currentPlayer].name} - ${game.getPhase()}`;
  if (game.getPhase() === "reinforce") {
    status += ` (${game.reinforcements} reinforcements)`;
  }
  document.getElementById("status").textContent = status;
}

function runAI() {
  while (
    game.players[game.currentPlayer].ai &&
    game.getPhase() !== "gameover"
  ) {
    game.performAITurn();
    updateUI();
  }
}

document.querySelectorAll(".territory").forEach((el) => {
  el.addEventListener("click", () => {
    const result = game.handleTerritoryClick(el.dataset.id);
    if (result) {
      const playerName = game.players[game.currentPlayer].name;
      if (result.type === "attack") {
        playAttackSound();
        const fromEl = document.getElementById(result.from);
        const toEl = document.getElementById(result.to);
        fromEl.classList.add("attack");
        toEl.classList.add("attack");
        setTimeout(() => {
          fromEl.classList.remove("attack");
          toEl.classList.remove("attack");
        }, 500);
        document.getElementById("diceResults").textContent =
          `Attacker: ${result.attackRolls.join(", ")} | Defender: ${result.defendRolls.join(", ")}`;
        if (result.conquered) {
          playConquerSound();
          toEl.classList.add("conquer");
          setTimeout(() => toEl.classList.remove("conquer"), 1000);
        }
        addLogEntry(`${playerName} attacca ${result.to} da ${result.from}`);
      } else if (result.type === "reinforce") {
        addLogEntry(`${playerName} rinforza ${result.territory}`);
      } else if (result.type === "fortify") {
        addLogEntry(`${playerName} sposta da ${result.from} a ${result.to}`);
      }
    }
    updateUI();
    if (result && result.type === "select") {
      document.getElementById(result.territory).classList.add("selected");
    }
    updateGameState(game.selectedFrom ? game.selectedFrom.id : null);
    updateInfoPanel();
    runAI();
  });
});

document.getElementById("endTurn").addEventListener("click", () => {
  const prev = game.currentPlayer;
  game.endTurn();
  if (game.getPhase() !== "reinforce") {
    game.endTurn();
  }
  if (prev !== game.currentPlayer) {
    gameState.turnNumber += 1;
    addLogEntry(
      `${game.players[prev].name} termina il turno. Ora tocca a ${game.players[game.currentPlayer].name}`,
    );
  }
  updateUI();
  updateGameState();
  updateInfoPanel();
  runAI();
});

const forceErrorBtn = document.getElementById("forceError");
if (forceErrorBtn) {
  forceErrorBtn.addEventListener("click", () => {
    throw new Error("Forced error for testing");
  });
}

updateUI();
runAI();

updateGameState();
updateInfoPanel();
addLogEntry(`Turno ${gameState.turnNumber}: ${game.players[game.currentPlayer].name}`);

if (typeof module !== "undefined") {
  module.exports = { game, updateUI, territoryPositions, runAI };
}
