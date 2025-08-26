/* global logger */
import initTerritorySelection from "./territory-selection.js";
import {
  playAttackSound,
  playConquerSound,
  setVolume,
  setMuted,
  isMuted,
  getVolume,
} from "./audio.js";
import askArmiesToMove from "./move-prompt.js";
import { navigateTo } from "./navigation.js";
import {
  REINFORCE,
  ATTACK,
  FORTIFY,
  GAME_OVER,
} from "./phases.js";
import { initThemeToggle } from "./theme.js";
import { initTutorialButtons } from "./tutorial.js";
import { attachStatsListeners, exportStats } from "./stats.js";
import {
  initUI,
  updateInfoPanel,
  addLogEntry,
  animateMove,
  animateAttack,
  animateReinforce,
  showVictoryModal,
  updateUI,
  destroyUI,
  resetSelectedCards,
  getSelectedCards,
  exportLog,
} from "./ui.js";
import initPhaseTimer from "./phase-timer.js";
import { loadGame as loadGameData } from "./src/init/game-loader.js";
import {
  updateGameState,
  clearSavedData,
  hasSavedPlayers,
  hasSavedGame,
} from "./src/state/storage.js";

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
let phaseTimer;

const gameState = {
  turnNumber: 1,
  currentPlayer: 0,
  players: [],
  territories: [],
  selectedTerritory: null,
  tokenPosition: null,
  phase: REINFORCE,
  log: [],
};

function checkForVictory() {
  const winner = game.checkVictory();
  if (winner !== null) {
    showVictoryModal(winner);
  }
}

async function startNewGame() {
  const modal = document.getElementById("victoryModal");
  if (modal) modal.classList.remove("show");
  clearSavedData();
  if (phaseTimer && typeof phaseTimer.stop === "function") {
    phaseTimer.stop();
  }
  destroyUI();
  navigateTo("setup.html");
}
function initialiseUI(game) {
  gameState.currentPlayer = game.currentPlayer;
  gameState.players = game.players;
  gameState.territories = game.territories;
  gameState.phase = game.getPhase();
  initUI({ game, gameState, territoryPositions });
  phaseTimer = initPhaseTimer({ game });
  attachAIActionLogging();
}

async function loadGame() {
  const result = await loadGameData();
  if (!result || !result.game) return;
  game = result.game;
  territoryPositions = result.territoryPositions;
  attachStatsListeners(game);
  initialiseUI(game);
  if (typeof module !== "undefined") {
    module.exports.game = game;
    module.exports.territoryPositions = territoryPositions;
  }
}

function runAI() {
  if (
    game.players[game.currentPlayer].ai &&
    game.getPhase() !== GAME_OVER
  ) {
    setTimeout(() => {
      game.performAITurn();
      updateUI();
      runAI();
    }, 0);
  }
}

let lastPlayer;

function attachAIActionLogging() {
  lastPlayer = game.currentPlayer;

  game.on(REINFORCE, ({ territory, player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} reinforces ${territory}`, {
        player: name,
        type: "reinforce",
        territories: [territory],
      });
      if (typeof logger !== "undefined") {
        logger.info(`${name} reinforces ${territory}`);
      }
    }
  });

  game.on(ATTACK, ({ from, to }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} attacks ${to} from ${from}`, {
        player: name,
        type: "attack",
        territories: [from, to],
      });
      if (typeof logger !== "undefined") {
        logger.info(`${name} attacks ${to} from ${from}`);
      }
    }
  });

  game.on("move", ({ from, to, count }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} moves ${count} from ${from} to ${to}`, {
        player: name,
        type: "move",
        territories: [from, to],
      });
      if (typeof logger !== "undefined") {
        logger.info(`${name} moves ${count} from ${from} to ${to}`);
      }
    }
  });

  game.on("cardsPlayed", ({ player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} plays cards`, {
        player: name,
        type: "cards",
      });
      if (typeof logger !== "undefined") {
        logger.info(`${name} plays cards`);
      }
    }
  });

  game.on("cardAwarded", ({ player, card }) => {
    const name = game.players[player].name;
    const icons = { infantry: "🪖", cavalry: "🐎", artillery: "💣" };
    addLogEntry(`${name} receives a card ${icons[card.type] || card.type}`, {
      player: name,
      type: "card",
    });
    if (typeof logger !== "undefined") {
      logger.info(`${name} receives card ${card.type}`);
    }
  });

  game.on("turnStart", ({ player }) => {
    const prev = lastPlayer;
    const prevName = game.players[prev].name;
    const nextName = game.players[player].name;
    if (game.players[prev].ai) {
      addLogEntry(`${prevName} ends turn. Next: ${nextName}`, {
        player: prevName,
        type: "endTurn",
      });
      if (typeof logger !== "undefined") {
        logger.info(`${prevName} ends turn. Next: ${nextName}`);
      }
      gameState.turnNumber += 1;
    }
    lastPlayer = player;
    updateGameState(gameState, game);
    updateInfoPanel();
  });
}

function attachTerritoryHandlers() {
  document.querySelectorAll(".territory").forEach((el) => {
    el.addEventListener("click", async () => {
      if (typeof logger !== "undefined") {
        logger.info(`Territory clicked: ${el.dataset.id}`);
      }
      try {
        const prevPlayer = game.currentPlayer;
        const result = game.handleTerritoryClick(el.dataset.id);
        if (result) {
          const playerName = game.players[prevPlayer].name;
          if (result.type === ATTACK) {
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
            const move = await askArmiesToMove(result.movableArmies, 0);
            if (move > 0) {
              game.moveArmies(result.from, result.to, move);
              addLogEntry(`${playerName} moves ${move} from ${result.from} to ${result.to}`, {
                player: playerName,
                type: "move",
                territories: [result.from, result.to],
              });
              animateMove(result.from, result.to);
            }
          }
          animateAttack(result.from, result.to);
          addLogEntry(`${playerName} attacks ${result.to} from ${result.from}`, {
            player: playerName,
            type: "attack",
            territories: [result.from, result.to],
          });
        } else if (result.type === REINFORCE) {
          if (typeof logger !== "undefined") {
            logger.info(`${playerName} reinforces ${result.territory}`);
          }
          animateReinforce(result.territory);
          addLogEntry(`${playerName} reinforces ${result.territory}`, {
            player: playerName,
            type: "reinforce",
            territories: [result.territory],
          });
          } else if (result.type === FORTIFY) {
            if (typeof logger !== "undefined") {
              logger.info(`${playerName} moves from ${result.from} to ${result.to}`);
            }
            const move = await askArmiesToMove(result.movableArmies, 1);
            if (move > 0) {
              game.moveArmies(result.from, result.to, move);
                addLogEntry(`${playerName} moves ${move} from ${result.from} to ${result.to}`, {
                  player: playerName,
                  type: "move",
                  territories: [result.from, result.to],
                });
              animateMove(result.from, result.to);
            }
            game.endTurn();
            const nextName = game.players[game.currentPlayer].name;
            gameState.turnNumber += 1;
              addLogEntry(
                `${playerName} ends turn. Next: ${nextName}`,
                { player: playerName, type: "endTurn" },
              );
            if (typeof logger !== "undefined") {
              logger.info(`${playerName} ends turn. Next: ${nextName}`);
            }
          }
        }
        updateUI();
        if (result && result.type === "select") {
          if (typeof logger !== "undefined") {
            logger.info(`${game.players[game.currentPlayer].name} selects ${result.territory}`);
          }
          document.getElementById(result.territory).classList.add("selected");
        }
        updateGameState(
          gameState,
          game,
          game.selectedFrom ? game.selectedFrom.id : null,
        );
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

const undoBtn = document.getElementById("undo");
if (undoBtn) {
  undoBtn.addEventListener("click", () => {
    try {
      if (game.undo()) {
        const playerName = game.players[game.currentPlayer].name;
        addLogEntry(`${playerName} undoes last action`, {
          player: playerName,
          type: "undo",
        });
        updateUI();
        updateGameState(
          gameState,
          game,
          game.selectedFrom ? game.selectedFrom.id : null,
        );
        updateInfoPanel();
      }
    } catch (err) {
      if (typeof logger !== "undefined") {
        logger.error(err);
      }
    }
  });
}

document.getElementById("endTurn").addEventListener("click", () => {
  if (typeof logger !== "undefined") {
    logger.info("End turn clicked");
  }
  try {
    const prevPlayer = game.currentPlayer;
    const prevPhase = game.getPhase();
    game.endTurn();
    if (prevPhase === ATTACK && game.getPhase() === FORTIFY) {
        addLogEntry(`${game.players[prevPlayer].name} enters fortify phase`, {
          player: game.players[prevPlayer].name,
          type: "phase",
        });
      if (typeof logger !== "undefined") {
        logger.info(`${game.players[prevPlayer].name} enters fortify phase`);
      }
    } else if (prevPhase === FORTIFY && game.getPhase() === REINFORCE) {
      gameState.turnNumber += 1;
        addLogEntry(
          `${game.players[prevPlayer].name} ends turn. Next: ${game.players[game.currentPlayer].name}`,
          { player: game.players[prevPlayer].name, type: "endTurn" },
        );
      if (typeof logger !== "undefined") {
        logger.info(
          `${game.players[prevPlayer].name} ends turn. Next: ${game.players[game.currentPlayer].name}`,
        );
      }
    }
    updateUI();
    updateGameState(gameState, game);
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

const exportLogBtn = document.getElementById("exportLog");
if (exportLogBtn) {
  exportLogBtn.addEventListener("click", () => {
    const logData = exportLog("json");
    const blob = new Blob([logData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "netrisk-log.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

async function initGame() {
  if (
    typeof window !== "undefined" &&
    !hasSavedPlayers() &&
    !hasSavedGame() &&
    !(typeof process !== "undefined" && process.env.JEST_WORKER_ID)
  ) {
    window.location.href = "setup.html";
    return;
  }
  await loadGame();
  const resetBtn = document.createElement("button");
  resetBtn.id = "resetGame";
  resetBtn.textContent = "New Game";
  resetBtn.classList.add("btn");
  resetBtn.addEventListener("click", startNewGame);
  document.body.appendChild(resetBtn);
  const modal = document.createElement("div");
  modal.id = "victoryModal";
  modal.className = "modal";
  modal.innerHTML =
    '<div class="modal-content"><h2 id="victoryTitle"></h2>' +
    '<div id="victoryStats"></div>' +
    '<canvas id="territoryChart" aria-label="Territories per turn" role="img"></canvas>' +
    '<canvas id="armiesChart" aria-label="Armies placed per turn" role="img"></canvas>' +
    '<canvas id="attackChart" aria-label="Attacks won and lost" role="img"></canvas>' +
    '<div class="modal-buttons">' +
    '<button id="shareResults" class="btn">Share Results</button>' +
    '<button id="exportStats" class="btn">Export JSON</button>' +
    '<button id="newGameBtn" class="btn">New Game</button>' +
    '</div></div>';
  document.body.appendChild(modal);
  document.getElementById("newGameBtn").addEventListener("click", startNewGame);
  document.getElementById("shareResults").addEventListener("click", () => {
    const canvas = document.getElementById("territoryChart");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "netrisk-results.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
  document.getElementById("exportStats").addEventListener("click", () => {
    const data = exportStats();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "netrisk-stats.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  const ui = document.getElementById("uiPanel");
  const cardPanel = document.createElement("div");
  cardPanel.id = "cardPanel";
  cardPanel.innerHTML =
    '<div><strong>Cards:</strong> <span id="cards"></span></div>' +
    '<button id="playCardsBtn" class="btn">Play cards</button>' +
    '<div id="bonusInfo"></div>';
  ui.appendChild(cardPanel);
  document.getElementById("playCardsBtn").addEventListener("click", () => {
    const cards = getSelectedCards();
    if (cards.length === 3) {
      if (game.playCards(cards)) {
        addLogEntry(`${game.players[game.currentPlayer].name} plays cards`, {
          player: game.players[game.currentPlayer].name,
          type: "cards",
        });
        resetSelectedCards();
        updateUI();
      }
    }
  });

  const volumeControl = document.getElementById("volumeControl");
  const muteBtn = document.getElementById("muteBtn");
  if (volumeControl) {
    volumeControl.value = getVolume();
    volumeControl.addEventListener("input", (e) => {
      setVolume(parseFloat(e.target.value));
    });
  }
  if (muteBtn) {
    muteBtn.textContent = isMuted() ? "Unmute" : "Mute";
    muteBtn.addEventListener("click", () => {
      const muted = isMuted();
      setMuted(!muted);
      muteBtn.textContent = muted ? "Mute" : "Unmute";
    });
  }
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

  updateGameState(gameState, game);
  updateInfoPanel();
    addLogEntry(`Turn ${gameState.turnNumber}: ${game.players[game.currentPlayer].name}`, {
      player: game.players[game.currentPlayer].name,
      type: "turn",
    });

  const toggleHowToPlay = document.getElementById("toggleHowToPlay");
  if (toggleHowToPlay) {
    toggleHowToPlay.addEventListener("click", () => {
      const steps = document.getElementById("howToPlaySteps");
      if (!steps) return;
      const nowHidden = steps.toggleAttribute("hidden");
      toggleHowToPlay.setAttribute("aria-expanded", (!nowHidden).toString());
      toggleHowToPlay.textContent = nowHidden
        ? "Show details"
        : "Hide details";
    });
  }
}

function init() {
  const menu = document.getElementById("mainMenu");
  const startBtn = document.getElementById("startGame");
  const container = document.getElementById("gameContainer");
  if (!menu || !startBtn || !container) {
    initGame();
    return;
  }
  container.classList.add("hidden");
  startBtn.addEventListener("click", async () => {
    menu.classList.add("hidden");
    container.classList.remove("hidden");
    await initGame();
  });
}

init();
initThemeToggle();
initTutorialButtons();

export {
  game,
  territoryPositions,
  runAI,
  attachTerritoryHandlers,
  startNewGame,
};
