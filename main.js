/* global logger */
import Game from "./game.js";
import initTerritorySelection from "./territory-selection.js";
import { playAttackSound, playConquerSound } from "./audio.js";
import askArmiesToMove from "./move-prompt.js";
import { navigateTo } from "./navigation.js";
import {
  REINFORCE,
  ATTACK,
  FORTIFY,
  GAME_OVER,
} from "./phases.js";
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
  phase: REINFORCE,
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
  let map;
  const mapName =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("netriskMap")) ||
    "map";
  try {
    const res = await fetch(`./src/data/${mapName}.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch map data: ${res.status}`);
    }
    map = await res.json();
  } catch (err) {
    if (typeof logger !== "undefined") {
      logger.error("Failed to load map data", err);
    }
    if (typeof alert !== "undefined") {
      alert("Unable to load game data. Please try again later.");
    }
    return;
  }
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
  attachAIActionLogging();
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
      addLogEntry(`${name} reinforces ${territory}`);
      if (typeof logger !== "undefined") {
        logger.info(`${name} reinforces ${territory}`);
      }
    }
  });

  game.on(ATTACK, ({ from, to }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} attacks ${to} from ${from}`);
      if (typeof logger !== "undefined") {
        logger.info(`${name} attacks ${to} from ${from}`);
      }
    }
  });

  game.on("move", ({ from, to, count }) => {
    if (game.players[game.currentPlayer].ai) {
      const name = game.players[game.currentPlayer].name;
      addLogEntry(`${name} moves ${count} from ${from} to ${to}`);
      if (typeof logger !== "undefined") {
        logger.info(`${name} moves ${count} from ${from} to ${to}`);
      }
    }
  });

  game.on("cardsPlayed", ({ player }) => {
    if (game.players[player].ai) {
      const name = game.players[player].name;
      addLogEntry(`${name} plays cards`);
      if (typeof logger !== "undefined") {
        logger.info(`${name} plays cards`);
      }
    }
  });

  game.on("cardAwarded", ({ player, card }) => {
    const name = game.players[player].name;
    const icons = { infantry: "🪖", cavalry: "🐎", artillery: "💣" };
    addLogEntry(`${name} receives a card ${icons[card.type] || card.type}`);
    if (typeof logger !== "undefined") {
      logger.info(`${name} receives card ${card.type}`);
    }
  });

  game.on("turnStart", ({ player }) => {
    const prev = lastPlayer;
    const prevName = game.players[prev].name;
    const nextName = game.players[player].name;
    if (game.players[prev].ai) {
      addLogEntry(`${prevName} ends turn. Next: ${nextName}`);
      if (typeof logger !== "undefined") {
        logger.info(`${prevName} ends turn. Next: ${nextName}`);
      }
      gameState.turnNumber += 1;
    }
    lastPlayer = player;
    updateGameState();
    updateInfoPanel();
  });
}

function attachTerritoryHandlers() {
  document.querySelectorAll(".territory").forEach((el) => {
    el.addEventListener("pointerdown", async () => {
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
                addLogEntry(`${playerName} moves ${move} from ${result.from} to ${result.to}`);
                animateMove(result.from, result.to);
              }
            }
            addLogEntry(`${playerName} attacks ${result.to} from ${result.from}`);
          } else if (result.type === REINFORCE) {
            if (typeof logger !== "undefined") {
              logger.info(`${playerName} reinforces ${result.territory}`);
            }
            addLogEntry(`${playerName} reinforces ${result.territory}`);
          } else if (result.type === FORTIFY) {
            if (typeof logger !== "undefined") {
              logger.info(`${playerName} moves from ${result.from} to ${result.to}`);
            }
            const move = await askArmiesToMove(result.movableArmies, 1);
            if (move > 0) {
              game.moveArmies(result.from, result.to, move);
              addLogEntry(`${playerName} moves ${move} from ${result.from} to ${result.to}`);
              animateMove(result.from, result.to);
            }
            game.endTurn();
            const nextName = game.players[game.currentPlayer].name;
            gameState.turnNumber += 1;
            addLogEntry(
              `${playerName} ends turn. Next: ${nextName}`,
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
    if (prevPhase === ATTACK && game.getPhase() === FORTIFY) {
      addLogEntry(`${game.players[prevPlayer].name} enters fortify phase`);
      if (typeof logger !== "undefined") {
        logger.info(`${game.players[prevPlayer].name} enters fortify phase`);
      }
    } else if (prevPhase === FORTIFY && game.getPhase() === REINFORCE) {
      gameState.turnNumber += 1;
      addLogEntry(
        `${game.players[prevPlayer].name} ends turn. Next: ${game.players[game.currentPlayer].name}`,
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

async function initGame() {
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
  resetBtn.textContent = "New Game";
  resetBtn.addEventListener("click", startNewGame);
  document.body.appendChild(resetBtn);
  const modal = document.createElement("div");
  modal.id = "victoryModal";
  modal.className = "modal";
  modal.innerHTML =
    '<div class="modal-content"><h2 id="victoryTitle"></h2><div id="victoryStats"></div><button id="newGameBtn">New Game</button></div>';
  document.body.appendChild(modal);
  document
    .getElementById("newGameBtn")
    .addEventListener("click", startNewGame);
  const ui = document.getElementById("uiPanel");
  const cardPanel = document.createElement("div");
  cardPanel.id = "cardPanel";
  cardPanel.innerHTML =
    '<div><strong>Cards:</strong> <span id="cards"></span></div>' +
    '<button id="playCardsBtn">Play cards</button>' +
    '<div id="bonusInfo"></div>';
  ui.appendChild(cardPanel);
  document.getElementById("playCardsBtn").addEventListener("click", () => {
    const cards = getSelectedCards();
    if (cards.length === 3) {
      if (game.playCards(cards)) {
        addLogEntry(`${game.players[game.currentPlayer].name} plays cards`);
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
  addLogEntry(`Turn ${gameState.turnNumber}: ${game.players[game.currentPlayer].name}`);

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
  container.style.display = "none";
  startBtn.addEventListener("click", async () => {
    menu.style.display = "none";
    container.style.display = "";
    await initGame();
  });
}

init();

export {
  game,
  territoryPositions,
  runAI,
  attachTerritoryHandlers,
  startNewGame,
};
