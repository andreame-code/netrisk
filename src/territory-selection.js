import { ATTACK, FORTIFY } from "./phases.js";
import { getBoardScale } from "./ui.js";
import * as logger from "./logger.js";

export default function initTerritorySelection({
  game,
  territories,
  addLogEntry,
  gameState,
  attachTerritoryHandlers,
  updateUI,
}) {
  let selectedTerritory = null;
  let possibleMoveEls = [];
  const infoPanel = document.getElementById("selectedTerritory");

  function selectTerritory(el) {
    if (selectedTerritory && selectedTerritory.el) {
      selectedTerritory.el.classList.remove("selected");
    }
    clearPossibleMoves();
    if (el) {
      const name = el.dataset.name || el.id;
      el.classList.add("selected");
      selectedTerritory = { id: el.id, name, el };
      infoPanel.textContent = name;
      logger.info(
        `Selected territory: ${selectedTerritory.id} (${selectedTerritory.name})`,
      );
      highlightPossibleMoves(el.id);
    } else {
      selectedTerritory = null;
      infoPanel.textContent = "";
    }
  }

  function clearPossibleMoves() {
    possibleMoveEls.forEach((el) => el.classList.remove("possible-move"));
    possibleMoveEls = [];
  }

  function highlightPossibleMoves(id) {
    if (!game) return;
    const terr = game.territoryById ? game.territoryById(id) : null;
    if (!terr) return;
    const phase = game.getPhase ? game.getPhase() : null;
    let targets = [];
    if (phase === ATTACK) {
      targets = terr.neighbors.filter(
        (n) => game.territoryById(n)?.owner !== game.currentPlayer,
      );
    } else if (phase === FORTIFY) {
      targets = terr.neighbors.filter(
        (n) => game.territoryById(n)?.owner === game.currentPlayer,
      );
    }
    targets.forEach((tid) => {
      const btn = document.getElementById(tid);
      if (btn) {
        btn.classList.add("possible-move");
        possibleMoveEls.push(btn);
      }
    });
  }

  function moveToken(el) {
    if (!el) return;
    const phase = game?.getPhase();
    if (phase && ![ATTACK, FORTIFY].includes(phase)) {
      addLogEntry?.(`Move not allowed during ${phase} phase`, { type: "error" });
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
        {
          player: game.players[game.currentPlayer].name,
          type: "token",
          territories: [el.id],
        },
      );
      logger.info(
        `${game.players[game.currentPlayer].name} moves token to ${name}`,
      );
    }
  }

  const moveBtn = document.getElementById("moveToken");
  if (moveBtn) {
    moveBtn.addEventListener("click", () => {
      logger.info("Move token clicked");
      try {
        if (selectedTerritory) {
          moveToken(selectedTerritory.el);
        } else {
          addLogEntry?.("No territory selected", { type: "error" });
        }
      } catch (err) {
        logger.error(err);
      }
    });
  }

  const mapName =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("netriskMap")) ||
    "map";
  fetch(`${mapName}.svg`)
    .then((r) => r.text())
    .then((svg) => {
      const boardEl = document.getElementById("board");
      boardEl.innerHTML = svg;
      const map = boardEl.querySelector("#map");
      map
        ?.querySelectorAll(".map-territory")
        .forEach((el) => {
          el.setAttribute("tabindex", "0");
          el.setAttribute("role", "button");
        });
      const tokenEl = document.createElement("div");
      tokenEl.id = "token";
      tokenEl.className = "token";
      const terrs = territories || game?.territories;
      if (terrs) {
        terrs.forEach((t) => {
          const terrEl = document.createElement("button");
          terrEl.type = "button";
          terrEl.id = t.id;
          terrEl.className = "territory";
          terrEl.dataset.id = t.id;
          if (t.name) {
            terrEl.setAttribute("aria-label", t.name);
          }
          boardEl.appendChild(terrEl);
        });
        attachTerritoryHandlers?.();
        updateUI?.();
      }
      // Append token after territory buttons so it appears above them
      boardEl.appendChild(tokenEl);
      if (gameState?.tokenPosition) {
        const scale = getBoardScale();
        tokenEl.style.left = `${gameState.tokenPosition.x * scale.x}px`;
        tokenEl.style.top = `${gameState.tokenPosition.y * scale.y}px`;
      }
      if (map) {
        map.addEventListener("click", (e) => {
          const target = e.target.closest(".map-territory");
          if (target) {
            selectTerritory(target);
          } else {
            selectTerritory(null);
          }
          e.stopPropagation();
        });
        map.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            const target = e.target.closest(".map-territory");
            if (target) {
              selectTerritory(target);
              if (e.key === " ") {
                e.preventDefault();
              }
            }
          }
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
      }
      })
      .catch((err) => {
        logger.error(err);
      });
  }

