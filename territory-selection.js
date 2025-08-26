import { ATTACK, FORTIFY } from "./phases.js";
import { getBoardScale } from "./ui.js";

export default function initTerritorySelection({
  logger,
  game,
  territories,
  addLogEntry,
  gameState,
  attachTerritoryHandlers,
  updateUI,
}) {
  let selectedTerritory = null;
  const infoPanel = document.getElementById("selectedTerritory");

  function selectTerritory(el) {
    if (selectedTerritory && selectedTerritory.el) {
      selectedTerritory.el.classList.remove("selected");
    }
    if (el) {
      const name = el.dataset.name || el.id;
      el.classList.add("selected");
      selectedTerritory = { id: el.id, name, el };
      infoPanel.textContent = name;
      if (logger) {
        logger.info(
          `Selected territory: ${selectedTerritory.id} (${selectedTerritory.name})`,
        );
      }
    } else {
      selectedTerritory = null;
      infoPanel.textContent = "";
    }
  }

  function moveToken(el) {
    if (!el) return;
    const phase = game?.getPhase();
    if (phase && ![ATTACK, FORTIFY].includes(phase)) {
      addLogEntry?.(`Move not allowed during ${phase} phase`);
      return;
    }
    const box = el.getBBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const token = document.getElementById("token");
    const scale = getBoardScale();
    if (token) {
      token.style.left = `${x * scale.x}px`;
      token.style.top = `${y * scale.y}px`;
    }
    if (gameState) {
      gameState.tokenPosition = { x, y };
    }
    if (addLogEntry && game) {
      const name = el.dataset.name || el.id;
      addLogEntry(
        `${game.players[game.currentPlayer].name} moves token to ${name}`,
      );
      logger?.info(
        `${game.players[game.currentPlayer].name} moves token to ${name}`,
      );
    }
  }

  const moveBtn = document.getElementById("moveToken");
  if (moveBtn) {
    moveBtn.addEventListener("click", () => {
      logger?.info("Move token clicked");
      try {
        if (selectedTerritory) {
          moveToken(selectedTerritory.el);
        } else {
          addLogEntry?.("No territory selected");
        }
      } catch (err) {
        logger?.error(err);
      }
    });
  }

  fetch("map.svg")
    .then((r) => r.text())
    .then((svg) => {
      const boardEl = document.getElementById("board");
      boardEl.innerHTML = svg;
      const tokenEl = document.createElement("div");
      tokenEl.id = "token";
      tokenEl.className = "token";
      boardEl.appendChild(tokenEl);
      const terrs = territories || game?.territories;
      if (terrs) {
        terrs.forEach((t) => {
          const terrEl = document.createElement("div");
          terrEl.id = t.id;
          terrEl.className = "territory";
          terrEl.dataset.id = t.id;
          boardEl.appendChild(terrEl);
        });
        attachTerritoryHandlers?.();
        updateUI?.();
      }
      if (gameState?.tokenPosition) {
        const scale = getBoardScale();
        tokenEl.style.left = `${gameState.tokenPosition.x * scale.x}px`;
        tokenEl.style.top = `${gameState.tokenPosition.y * scale.y}px`;
      }
        const map = boardEl.querySelector("#map");
        map.addEventListener("pointerdown", (e) => {
          const target = e.target.closest(".map-territory");
          if (target) {
            selectTerritory(target);
          } else {
            selectTerritory(null);
          }
          e.stopPropagation();
        });
        map.addEventListener("dblclick", (e) => {
          const target = e.target.closest(".map-territory");
          if (target) {
            selectTerritory(target);
            moveToken(target);
          }
          e.stopPropagation();
        });
        document.addEventListener("pointerdown", (e) => {
          if (!map.contains(e.target)) {
            selectTerritory(null);
          }
        });
      })
      .catch((err) => {
        logger?.error(err);
      });
  }

