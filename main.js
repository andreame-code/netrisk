/* global logger */
import Game from "./game.js";
import initTerritorySelection from "./territory-selection.js";
import { playAttackSound, playConquerSound } from "./audio.js";
import askArmiesToMove from "./move-prompt.js";
import { navigateTo } from "./navigation.js";
import {
  initUI,
  updateInfoPanel,
  addLogEntry,
  animateMove,
  showVictoryModal,
  updateUI,
  resetSelectedCards,
  getSelectedCards,
} from "./ui.js";

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
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("netriskGame", game.serialize());
    } catch (err) {
      if (typeof logger !== "undefined") {
        logger.error("Failed to save game", err);
      }
    }
  }
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
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("netriskGame");
    localStorage.removeItem("netriskPlayers");
  }
  navigateTo("setup.html");
}

async function loadGame() {
  const res = await fetch("./src/data/map.json");
  const map = await res.json();
  territoryPositions = map.territories.reduce((acc, t) => {
    acc[t.id] = { x: t.x, y: t.y };
    return acc;
  }, {});
  const GameClass =
    (typeof window !== "undefined" && window.Game) || Game;
  if (typeof GameClass !== "function") {
    throw new Error("Game class not available");
  }
  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("netriskGame");
      if (saved) {
        game = GameClass.deserialize(saved);
      }
    } catch (err) {
      if (typeof logger !== "undefined") {
        logger.error("Failed to load saved game", err);
      }
    }
  }
  if (!game) {
    let players = [];
    if (typeof localStorage !== "undefined") {
      try {
        players = JSON.parse(localStorage.getItem("netriskPlayers")) || [];
      } catch (err) {
        players = [];
      }
    }
    game = new GameClass(
      players.length ? players : null,
      map.territories,
      map.continents,
      map.deck,
    );
    if (typeof logger !== "undefined") {
      logger.info("Game initialised");
    }
  }
  gameState.currentPlayer = game.currentPlayer;
  gameState.players = game.players;
  gameState.territories = game.territories;
  gameState.phase = game.getPhase();
  initUI({ game, gameState, territoryPositions });
}

function runAI() {
  if (
    game.players[game.currentPlayer].ai &&
    game.getPhase() !== "gameover"
  ) {
    setTimeout(() => {
      game.performAITurn();
      updateUI();
      runAI();
    }, 0);
  }
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
              const move = await askArmiesToMove(result.movableArmies, 0);
              if (move > 0) {
                game.moveArmies(result.from, result.to, move);
                addLogEntry(`${playerName} sposta ${move} da ${result.from} a ${result.to}`);
                animateMove(result.from, result.to);
              }
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
            const move = await askArmiesToMove(result.movableArmies, 1);
            if (move > 0) {
              game.moveArmies(result.from, result.to, move);
              addLogEntry(`${playerName} sposta ${move} da ${result.from} a ${result.to}`);
              animateMove(result.from, result.to);
            }
            game.endTurn();
            const nextName = game.players[game.currentPlayer].name;
            gameState.turnNumber += 1;
            addLogEntry(
              `${playerName} termina il turno. Ora tocca a ${nextName}`,
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
    const prevPlayer = game.currentPlayer;
    const prevPhase = game.getPhase();
    game.endTurn();
    if (prevPhase === "attack" && game.getPhase() === "fortify") {
      addLogEntry(`${game.players[prevPlayer].name} passa alla fase fortificazioni`);
      if (typeof logger !== "undefined") {
        logger.info(`${game.players[prevPlayer].name} enters fortify phase`);
      }
    } else if (prevPhase === "fortify" && game.getPhase() === "reinforce") {
      gameState.turnNumber += 1;
      addLogEntry(
        `${game.players[prevPlayer].name} termina il turno. Ora tocca a ${game.players[game.currentPlayer].name}`,
      );
      if (typeof logger !== "undefined") {
        logger.info(
          `${game.players[prevPlayer].name} ends turn. Next: ${game.players[game.currentPlayer].name}`,
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
  if (
    typeof window !== "undefined" &&
    typeof localStorage !== "undefined" &&
    !localStorage.getItem("netriskPlayers") &&
    !(typeof process !== "undefined" && process.env.JEST_WORKER_ID)
  ) {
    window.location.href = "setup.html";
    return;
  }
  await loadGame();
  const resetBtn = document.createElement("button");
  resetBtn.id = "resetGame";
  resetBtn.textContent = "Nuova partita";
  resetBtn.addEventListener("click", startNewGame);
  document.body.appendChild(resetBtn);
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
    const cards = getSelectedCards();
    if (cards.length === 3) {
      if (game.playCards(cards)) {
        addLogEntry(`${game.players[game.currentPlayer].name} gioca carte`);
        resetSelectedCards();
        game.calculateReinforcements();
        updateUI();
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
  territoryPositions,
  runAI,
  attachTerritoryHandlers,
  startNewGame,
};
