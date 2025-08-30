import { ATTACK, FORTIFY } from "./phases.js";
import { getBoardScale, getElement } from "./ui.js";
import * as logger from "./logger.js";

export default function initTerritorySelection({
  game,
  territories,
  gameState,
  attachTerritoryHandlers,
  updateUI,
  territoryPositions = {},
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
      const btn = getElement(tid);
      if (btn) {
        btn.classList.add("possible-move");
        possibleMoveEls.push(btn);
      }
    });
  }


  const mapName =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("netriskMap")) ||
    "map";
  const boardEl = document.getElementById("board");

  function loadMap(paths) {
    if (!paths.length) {
      boardEl.textContent = "Error loading map";
      throw new Error("Failed to load map");
    }
    const [path, ...rest] = paths;
    return fetch(path)
      .then((r) => {
        if (r.ok) {
          return r.text();
        }
        return loadMap(rest);
      })
      .catch(() => loadMap(rest));
  }

  loadMap([
    `/assets/maps/${mapName}.svg`,
    `assets/maps/${mapName}.svg`,
    `public/assets/maps/${mapName}.svg`,
  ])
    .then((svg) => {
      boardEl.innerHTML = svg;
      const map = boardEl.querySelector("#map");
      const territoryEls = map?.querySelectorAll(".map-territory") || [];
      if (!territoryEls.length) {
        boardEl.textContent = "Invalid map";
        throw new Error("Map SVG missing .map-territory elements");
      }
      territoryEls.forEach((el) => {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "button");
      });

      function computeFallbackPosition(id) {
        const selector =
          typeof CSS !== "undefined" && CSS.escape ? `#${CSS.escape(id)}` : `#${id}`;
        const terrPath = map?.querySelector(selector);
        if (!terrPath || typeof terrPath.getBBox !== "function") return null;
        const { x, y, width, height } = terrPath.getBBox();
        return { x: x + width / 2, y: y + height / 2 };
      }

      const tokenEl = document.createElement("div");
      tokenEl.id = "token";
      tokenEl.className = "token";
      const terrs = territories || game?.territories;
      if (terrs) {
        const viewBox = map?.viewBox?.baseVal;
        const margin = 10;
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
          if (!territoryPositions[t.id]) {
            const pos = computeFallbackPosition(t.id);
            if (pos) {
              let { x, y } = pos;
              if (viewBox) {
                x = Math.min(Math.max(x, margin), viewBox.width - margin);
                y = Math.min(Math.max(y, margin), viewBox.height - margin);
              }
              territoryPositions[t.id] = { x, y };
            }
          }
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

