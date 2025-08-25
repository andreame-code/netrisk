/* global logger */
import initTerritorySelection from "./territory-selection.js";

// Remove any previously registered service workers to avoid stale caches
// and log their status so that we know if any were present.
if (typeof navigator !== "undefined" && navigator.serviceWorker) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      if (typeof logger !== "undefined") {
        logger.info(`Found ${regs.length} service worker(s)`);
      }
      regs.forEach((reg) => reg.unregister());
    })
    .catch((err) => {
      if (typeof logger !== "undefined") {
        logger.error("Service worker check failed", err);
      }
    });
}

let game;
let territoryPositions = {};
let selectedCards = [];

const gameState = {
  turnNumber: 1,
  currentPlayer: 0,
  players: [],
  territories: [],
  selectedTerritory: null,
  tokenPosition: null,
  phase: "reinforce",
  log: [],
};

function updateGameState(selected = null) {
  gameState.currentPlayer = game.currentPlayer;
  gameState.players = game.players;
  gameState.territories = game.territories;
  gameState.phase = game.getPhase();
  gameState.selectedTerritory = selected;
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

function animateMove(from, to) {
  const board = document.getElementById("board");
  if (!board) return;
  const fromPos = territoryPositions[from];
  const toPos = territoryPositions[to];
  if (!fromPos || !toPos) return;
  const token = document.createElement("div");
  token.className = "token move-token";
  token.style.left = fromPos.x + "px";
  token.style.top = fromPos.y + "px";
  board.appendChild(token);
  requestAnimationFrame(() => {
    token.style.left = toPos.x + "px";
    token.style.top = toPos.y + "px";
  });
  token.addEventListener(
    "transitionend",
    () => {
      token.classList.add("animate__animated", "animate__fadeOut");
      token.addEventListener("animationend", () => token.remove(), { once: true });
    },
    { once: true },
  );
}

function showVictoryModal(winnerIdx) {
  const modal = document.getElementById("victoryModal");
  if (!modal) return;
  const title = document.getElementById("victoryTitle");
  const stats = document.getElementById("victoryStats");
  if (title) title.textContent = `${game.players[winnerIdx].name} ha vinto!`;
  if (stats) {
    const terr = game.players.map((p, idx) => {
      const count = game.territories.filter((t) => t.owner === idx).length;
      return `<li>${p.name}: ${count} territori</li>`;
    });
    stats.innerHTML = `<p>Turni: ${gameState.turnNumber}</p><ul>${terr.join("")}</ul>`;
  }
  modal.classList.add("show");
}

function checkForVictory() {
  const winner = game.checkVictory();
  if (winner !== null) {
    showVictoryModal(winner);
  }
}

async function startNewGame() {
  const modal = document.getElementById("victoryModal");
  if (modal) modal.classList.remove("show");
  await loadGame();
  gameState.turnNumber = 1;
  gameState.log = [];
  const logEl = document.getElementById("actionLog");
  if (logEl) logEl.innerHTML = "";
  selectedCards = [];
  updateUI();
  updateGameState();
  updateInfoPanel();
  addLogEntry(`Turno ${gameState.turnNumber}: ${game.players[game.currentPlayer].name}`);
  runAI();
  checkForVictory();
}

async function loadGame() {
  const res = await fetch("./src/data/map.json");
  const map = await res.json();
  territoryPositions = map.territories.reduce((acc, t) => {
    acc[t.id] = { x: t.x, y: t.y };
    return acc;
  }, {});
  const GameClass = window.Game;
  let players = null;
  if (typeof localStorage !== "undefined") {
    try {
      players = JSON.parse(localStorage.getItem("netriskPlayers"));
    } catch (err) {
      players = null;
    }
  }
  game = new GameClass(players, map.territories);
  if (typeof logger !== "undefined") {
    logger.info("Game initialised");
  }
  gameState.currentPlayer = game.currentPlayer;
  gameState.players = game.players;
  gameState.territories = game.territories;
  gameState.phase = game.getPhase();
}

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

function updateBonusInfo() {
  const bonusEl = document.getElementById("bonusInfo");
  if (!bonusEl) return;
  const bonuses = game.continents
    .filter((c) =>
      c.territories.every((id) => game.territoryById(id).owner === game.currentPlayer),
    )
    .map((c) => `${c.name} +${c.bonus}`);
  bonusEl.textContent = bonuses.length ? `Bonus: ${bonuses.join(", ")}` : "";
}

function updateCardsUI() {
  const container = document.getElementById("cards");
  if (!container) return;
  container.innerHTML = "";
  const hand = game.hands[game.currentPlayer] || [];
  selectedCards = [];
  hand.forEach((card, idx) => {
    const el = document.createElement("span");
    el.textContent = card.type;
    el.dataset.idx = idx;
    el.className = "card";
    if (selectedCards.includes(idx)) el.classList.add("selected-card");
    el.addEventListener("click", () => {
      if (selectedCards.includes(idx)) {
        selectedCards = selectedCards.filter((i) => i !== idx);
        el.classList.remove("selected-card");
      } else if (selectedCards.length < 3) {
        selectedCards.push(idx);
        el.classList.add("selected-card");
      }
    });
    container.appendChild(el);
  });
}

function updateUI() {
  game.territories.forEach((t) => {
    const el = document.getElementById(t.id);
    if (!el) return;
    el.style.background = game.players[t.owner].color;
    el.textContent = t.armies;
    const pos = territoryPositions[t.id];
    if (pos) {
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
    }
    el.classList.remove("selected");
  });
  let status = `${game.players[game.currentPlayer].name} - ${game.getPhase()}`;
  if (game.getPhase() === "reinforce") {
    status += ` (${game.reinforcements} reinforcements)`;
  }
  document.getElementById("status").textContent = status;
  updateBonusInfo();
  updateCardsUI();
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

function attachTerritoryHandlers() {
  document.querySelectorAll(".territory").forEach((el) => {
    el.addEventListener("click", () => {
      if (typeof logger !== "undefined") {
        logger.info(`Territory clicked: ${el.dataset.id}`);
      }
      try {
        const result = game.handleTerritoryClick(el.dataset.id);
        if (result) {
          const playerName = game.players[game.currentPlayer].name;
          if (result.type === "attack") {
            if (typeof logger !== "undefined") {
              logger.info(`${playerName} attacks ${result.to} from ${result.from}`);
            }
            playAttackSound();
            const fromEl = document.getElementById(result.from);
            const toEl = document.getElementById(result.to);
            fromEl.classList.add("attack", "animate__animated", "animate__shakeX");
            toEl.classList.add("attack", "animate__animated", "animate__shakeX");
            setTimeout(() => {
              fromEl.classList.remove("attack", "animate__animated", "animate__shakeX");
              toEl.classList.remove("attack", "animate__animated", "animate__shakeX");
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
            if (typeof logger !== "undefined") {
              logger.info(`${playerName} reinforces ${result.territory}`);
            }
            addLogEntry(`${playerName} rinforza ${result.territory}`);
          } else if (result.type === "fortify") {
            if (typeof logger !== "undefined") {
              logger.info(`${playerName} moves from ${result.from} to ${result.to}`);
            }
            addLogEntry(`${playerName} sposta da ${result.from} a ${result.to}`);
            animateMove(result.from, result.to);
          }
        }
        updateUI();
        if (result && result.type === "select") {
          if (typeof logger !== "undefined") {
            logger.info(`${game.players[game.currentPlayer].name} selects ${result.territory}`);
          }
          document.getElementById(result.territory).classList.add("selected");
        }
        updateGameState(game.selectedFrom ? game.selectedFrom.id : null);
        updateInfoPanel();
        runAI();
        checkForVictory();
      } catch (err) {
        if (typeof logger !== "undefined") {
          logger.error(err);
        }
      }
    });
  });
}

document.getElementById("endTurn").addEventListener("click", () => {
  if (typeof logger !== "undefined") {
    logger.info("End turn clicked");
  }
  try {
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
      if (typeof logger !== "undefined") {
        logger.info(
          `${game.players[prev].name} ends turn. Next: ${game.players[game.currentPlayer].name}`,
        );
      }
    }
    updateUI();
    updateGameState();
    updateInfoPanel();
    runAI();
    checkForVictory();
  } catch (err) {
    if (typeof logger !== "undefined") {
      logger.error(err);
    }
  }
});

const forceErrorBtn = document.getElementById("forceError");
if (forceErrorBtn) {
  forceErrorBtn.addEventListener("click", () => {
    throw new Error("Forced error for testing");
  });
}

async function init() {
  await loadGame();
  const modal = document.createElement("div");
  modal.id = "victoryModal";
  modal.className = "modal";
  modal.innerHTML =
    '<div class="modal-content"><h2 id="victoryTitle"></h2><div id="victoryStats"></div><button id="newGameBtn">Nuova partita</button></div>';
  document.body.appendChild(modal);
  document
    .getElementById("newGameBtn")
    .addEventListener("click", startNewGame);
  const ui = document.getElementById("uiPanel");
  const cardPanel = document.createElement("div");
  cardPanel.id = "cardPanel";
  cardPanel.innerHTML =
    '<div><strong>Carte:</strong> <span id="cards"></span></div>' +
    '<button id="playCardsBtn">Gioca carte</button>' +
    '<div id="bonusInfo"></div>';
  ui.appendChild(cardPanel);
  document.getElementById("playCardsBtn").addEventListener("click", () => {
    if (selectedCards.length === 3) {
      if (game.playCards(selectedCards)) {
        addLogEntry(`${game.players[game.currentPlayer].name} gioca carte`);
        selectedCards = [];
        game.calculateReinforcements();
        updateUI();
        updateCardsUI();
      }
    }
  });
  initTerritorySelection({
    logger,
    game,
    territories: game.territories,
    addLogEntry,
    gameState,
    attachTerritoryHandlers,
    updateUI,
  });

  updateUI();
  runAI();
  checkForVictory();

  updateGameState();
  updateInfoPanel();
  addLogEntry(`Turno ${gameState.turnNumber}: ${game.players[game.currentPlayer].name}`);

  const toggleHowToPlay = document.getElementById("toggleHowToPlay");
  if (toggleHowToPlay) {
    toggleHowToPlay.addEventListener("click", (e) => {
      e.preventDefault();
      const steps = document.getElementById("howToPlaySteps");
      if (!steps) return;
      const hidden = steps.style.display === "none";
      steps.style.display = hidden ? "block" : "none";
      toggleHowToPlay.textContent = hidden
        ? "Nascondi dettagli"
        : "Mostra dettagli";
    });
  }
}

init();

export {
  game,
  updateUI,
  territoryPositions,
  runAI,
  attachTerritoryHandlers,
  addLogEntry,
};
