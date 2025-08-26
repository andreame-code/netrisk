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
import { REINFORCE, ATTACK, FORTIFY } from "./phases.js";
import {
  initUI,
  updateInfoPanel,
  addLogEntry,
  animateMove,
  showVictoryModal,
  updateUI,
  resetSelectedCards,
  getSelectedCards,
  getLog,
} from "./ui.js";
import { game, territoryPositions, loadGame, startNewGame } from "./game-loader.js";
import { updateGameState } from "./persistence.js";
import { runAI } from "./ai-runner.js";
import { attachAIActionLogging } from "./ai-logger.js";

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

function initialiseUI(currentGame) {
  gameState.currentPlayer = currentGame.currentPlayer;
  gameState.players = currentGame.players;
  gameState.territories = currentGame.territories;
  gameState.phase = currentGame.getPhase();
  initUI({ game: currentGame, gameState, territoryPositions });
  attachAIActionLogging(
    currentGame,
    gameState,
    addLogEntry,
    () => updateGameState(currentGame, gameState),
    updateInfoPanel,
  );
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
        updateGameState(game, gameState, game.selectedFrom ? game.selectedFrom.id : null);
        updateInfoPanel();
        runAI(game, updateUI);
        checkForVictory();
      } catch (err) {
        if (typeof logger !== "undefined") {
          logger.error(err);
        }
      }
    });
  });
}

const endTurnBtn = document.getElementById("endTurn");
if (endTurnBtn) {
  endTurnBtn.addEventListener("click", () => {
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
      updateGameState(game, gameState);
      updateInfoPanel();
      runAI(game, updateUI);
      checkForVictory();
    } catch (err) {
      if (typeof logger !== "undefined") {
        logger.error(err);
      }
    }
  });
}
const forceErrorBtn = document.getElementById("forceError");
if (forceErrorBtn) {
  forceErrorBtn.addEventListener("click", () => {
    throw new Error("Forced error for testing");
  });
}

const exportLogBtn = document.getElementById("exportLog");
if (exportLogBtn) {
  exportLogBtn.addEventListener("click", () => {
    const logData = getLog();
    const blob = new Blob([logData.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "netrisk-log.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
  initialiseUI(game);
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
  const uiPanel = document.getElementById("uiPanel");
  const cardPanel = document.createElement("div");
  cardPanel.id = "cardPanel";
  cardPanel.innerHTML =
    '<div><strong>Cards:</strong> <span id="cards"></span></div>' +
    '<button id="playCardsBtn">Play cards</button>' +
    '<div id="bonusInfo"></div>';
  uiPanel.appendChild(cardPanel);
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
  runAI(game, updateUI);
  checkForVictory();

  updateGameState(game, gameState);
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

export { init, attachTerritoryHandlers, initialiseUI, gameState, checkForVictory };
