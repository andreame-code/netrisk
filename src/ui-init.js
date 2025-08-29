import initTerritorySelection from "./territory-selection.js";
import * as logger from "./logger.js";
import {
  playEffect,
  preloadEffects,
  setMasterVolume,
  getMasterVolume,
  setEffectsVolume,
  getEffectsVolume,
  setMuted,
  isMuted,
  setMusicEnabled,
  isMusicEnabled,
  setLevelMusic,
} from "./audio.js";
import askArmiesToMove from "./move-prompt.js";
import { navigateTo, exitGame } from "./navigation.js";
import {
  REINFORCE,
  ATTACK,
  FORTIFY,
  GAME_OVER,
} from "./phases.js";
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
  getElement,
} from "./ui.js";
import initPhaseTimer from "./phase-timer.js";
import { WS_URL } from "./config.js";
import { loadGame as loadGameData } from "./init/game-loader.js";
import {
  updateGameState,
  clearSavedData,
  hasSavedPlayers,
  hasSavedGame,
  getMapName,
} from "./state/storage.js";
import { applyLevelAccessibility } from "./data/level-accessibility.js";
import { gameState, initGameState } from "./state/game.js";
import attachAIActionLogging from "./ai-logging.js";

let game;
let territoryPositions = {};
let phaseTimer;

const loadErrorEl = document.getElementById("loadError");
const loadErrorMsg = document.getElementById("loadErrorMsg");
const retryBtn = document.getElementById("retryLoad");
let retryAction = () => loadGame();

function showLoadError(
  message = "Unable to load game data. Check your connection and try again.",
  action = () => loadGame(),
) {
  if (loadErrorEl && loadErrorMsg) {
    loadErrorMsg.textContent = message;
    loadErrorEl.classList.remove("hidden");
    retryAction = action;
  }
}

if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    if (loadErrorEl) loadErrorEl.classList.add("hidden");
    retryAction();
  });
}

function handleImageError(event) {
  const img = event?.target;
  if (!img) return;
  showLoadError(
    "Some game pieces couldn't be loaded. We'll try again automatically. If the problem continues, press Retry.",
    () => location.reload(),
  );
  if (!img.dataset.retry) {
    img.dataset.retry = "1";
    img.addEventListener(
      "load",
      () => {
        if (loadErrorEl) loadErrorEl.classList.add("hidden");
      },
      { once: true },
    );
    setTimeout(() => {
      const sep = img.src.includes("?") ? "&" : "?";
      img.src = `${img.src}${sep}retry=${Date.now()}`;
    }, 1000);
  }
}

window.addEventListener(
  "error",
  (e) => {
    if (e?.target?.tagName === "IMG") {
      handleImageError(e);
    }
  },
  true,
);

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
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  if (params && params.get("multiplayer")) {
    navigateTo("lobby.html");
  } else {
    navigateTo("setup.html");
  }
}

function initialiseUI(gameInstance) {
  initGameState(gameInstance);
  initUI({ game: gameInstance, gameState, territoryPositions });
  phaseTimer = initPhaseTimer({ game: gameInstance });
  attachAIActionLogging(gameInstance);
}

async function loadGame() {
  try {
    const result = await loadGameData();
    if (!result || !result.game) {
      showLoadError();
      return;
    }
    if (loadErrorEl) loadErrorEl.classList.add("hidden");
    game = result.game;
    territoryPositions = result.territoryPositions;
    attachStatsListeners(game);
    initialiseUI(game);
    if (typeof module !== "undefined") {
      module.exports.game = game;
      module.exports.territoryPositions = territoryPositions;
    }
  } catch {
    showLoadError();
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

function attachTerritoryHandlers() {
  document.querySelectorAll(".territory").forEach((el) => {
    el.addEventListener("click", async () => {
      logger.info(`Territory clicked: ${el.dataset.id}`);
      try {
        const prevPlayer = game.currentPlayer;
        const result = game.handleTerritoryClick(el.dataset.id);
        if (result) {
          const playerName = game.players[prevPlayer].name;
          if (result.type === ATTACK) {
            logger.info(`${playerName} attacks ${result.to} from ${result.from}`);
            const fromEl = getElement(result.from);
            const toEl = getElement(result.to);
            fromEl.classList.add("attack", "animate__animated", "animate__shakeX");
            toEl.classList.add("attack", "animate__animated", "animate__shakeX");
            setTimeout(() => {
              fromEl.classList.remove("attack", "animate__animated", "animate__shakeX");
              toEl.classList.remove("attack", "animate__animated", "animate__shakeX");
            }, 500);
            document.getElementById("diceResults").textContent =
              `Attacker: ${result.attackRolls.join(", ")} | Defender: ${result.defendRolls.join(", ")}`;
            if (result.conquered) {
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
            logger.info(`${playerName} reinforces ${result.territory}`);
            animateReinforce(result.territory);
            addLogEntry(`${playerName} reinforces ${result.territory}`, {
              player: playerName,
              type: "reinforce",
              territories: [result.territory],
            });
          } else if (result.type === FORTIFY) {
            logger.info(`${playerName} moves from ${result.from} to ${result.to}`);
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
            gameState.incrementTurnNumber();
            addLogEntry(
              `${playerName} ends turn. Next: ${nextName}`,
              { player: playerName, type: "endTurn" },
            );
            logger.info(`${playerName} ends turn. Next: ${nextName}`);
          }
        }
        updateUI();
        if (result && result.type === "select") {
          logger.info(`${game.players[game.currentPlayer].name} selects ${result.territory}`);
          const selEl = getElement(result.territory);
          if (selEl) {
            selEl.classList.add("selected");
          }
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
        logger.error(err);
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
      } else {
        addLogEntry("Undo is only available during reinforcement phase", {
          type: "undo",
        });
      }
    } catch (err) {
      logger.error(err);
    }
  });
}

document.getElementById("endTurn").addEventListener("click", () => {
  logger.info("End turn clicked");
  try {
    const prevPlayer = game.currentPlayer;
    const prevPhase = game.getPhase();
    game.endTurn();
    if (prevPhase === ATTACK && game.getPhase() === FORTIFY) {
      addLogEntry(`${game.players[prevPlayer].name} enters fortify phase`, {
        player: game.players[prevPlayer].name,
        type: "phase",
      });
      logger.info(`${game.players[prevPlayer].name} enters fortify phase`);
    } else if (prevPhase === FORTIFY && game.getPhase() === REINFORCE) {
      gameState.incrementTurnNumber();
      addLogEntry(
        `${game.players[prevPlayer].name} ends turn. Next: ${game.players[game.currentPlayer].name}`,
        { player: game.players[prevPlayer].name, type: "endTurn" },
      );
      logger.info(
        `${game.players[prevPlayer].name} ends turn. Next: ${game.players[game.currentPlayer].name}`,
      );
    }
    updateUI();
    updateGameState(gameState, game);
    updateInfoPanel();
    runAI();
    checkForVictory();
  } catch (err) {
    logger.error(err);
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
  const IS_TEST = typeof jest !== "undefined";
  if (
    typeof window !== "undefined" &&
    !hasSavedPlayers() &&
    !hasSavedGame() &&
    !IS_TEST
  ) {
    if (typeof window.alert === "function") {
      window.alert("No saved players or map found. Redirecting to setup.");
    }
    navigateTo("setup.html");
    return;
  }
  await loadGame();
  if (!game) {
    logger.error("Failed to load game");
    return;
  }
  const mapName = getMapName();
  setLevelMusic(mapName);
  applyLevelAccessibility(mapName);

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  if (params && params.get("multiplayer")) {
    const { default: createWebSocketMultiplayer } = await import(
      "./plugins/websocket-multiplayer-plugin.js"
    );
    game.use(createWebSocketMultiplayer(WS_URL));
  }

  preloadEffects();

  let firstTurn = true;
  game.on(REINFORCE, () => playEffect("reinforce"));
  game.on("attackResolved", ({ result }) => {
    if (result.conquered) {
      playEffect("conquer");
    } else if (result.defenderLosses > result.attackerLosses) {
      playEffect("attackWin");
    } else {
      playEffect("attackLoss");
    }
  });
  game.on("turnStart", () => {
    if (!firstTurn) playEffect("endTurn");
    firstTurn = false;
  });
  game.on("undoUnavailable", () => {
    addLogEntry("Undo is only available during reinforcement phase", {
      type: "undo",
    });
  });
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
    const cardPanel = document.getElementById("cardPanel");
    if (cardPanel) {
      cardPanel.innerHTML =
        '<div><strong>Cards:</strong> <span id="cards"></span></div>' +
        '<button id="playCardsBtn" class="btn">Play cards</button>' +
        '<div id="bonusInfo"></div>';
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
    }

  const masterVolume = document.getElementById("masterVolume");
  const effectsVolume = document.getElementById("effectsVolume");
  const muteBtn = document.getElementById("muteBtn");
  const musicToggle = document.getElementById("musicToggle");
  if (masterVolume) {
    masterVolume.value = getMasterVolume();
    masterVolume.addEventListener("input", (e) => {
      setMasterVolume(parseFloat(e.target.value));
    });
  }
  if (effectsVolume) {
    effectsVolume.value = getEffectsVolume();
    effectsVolume.addEventListener("input", (e) => {
      setEffectsVolume(parseFloat(e.target.value));
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
  if (musicToggle) {
    musicToggle.textContent = isMusicEnabled() ? "Music Off" : "Music On";
    musicToggle.addEventListener("click", () => {
      const on = isMusicEnabled();
      setMusicEnabled(!on);
      musicToggle.textContent = on ? "Music On" : "Music Off";
    });
  }
  initTerritorySelection({
    game,
    territories: game.territories,
    addLogEntry,
    gameState,
    attachTerritoryHandlers,
    updateUI,
    territoryPositions,
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

function attachNavigationHandlers() {
  const exit = document.getElementById("exitGame");
  if (exit) {
    exit.addEventListener("click", (e) => {
      e.preventDefault();
      exitGame();
    });
  }
}

export {
  game,
  territoryPositions,
  runAI,
  attachTerritoryHandlers,
  startNewGame,
  initGame,
  attachNavigationHandlers,
};
