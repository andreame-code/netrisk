import { getContrastingColor } from "./colors.js";
import { REINFORCE } from "./phases.js";
import { getStats } from "./stats.js";

const BOARD_WIDTH = 600;
const BOARD_HEIGHT = 400;

// cache DOM lookups to avoid repetitive queries
function createElementCache() {
  let cache = {};
  return {
    get(id) {
      if (!cache[id]) {
        cache[id] = document.getElementById(id);
      }
      return cache[id];
    },
    clear() {
      cache = {};
    },
  };
}

const elementCache = createElementCache();
function getElement(id) {
  return elementCache.get(id);
}

function getBoardScale() {
  const board = getElement("board");
  if (!board) return { x: 1, y: 1 };
  const width = board.clientWidth || board.getBoundingClientRect().width;
  const height = board.clientHeight || board.getBoundingClientRect().height;
  const x = width ? width / BOARD_WIDTH : 1;
  const y = height ? height / BOARD_HEIGHT : 1;
  return { x, y };
}

let game;
let gameState;
let territoryPositions = {};
let selectedCards = [];
let resizeHandler;

function initUI({ game: g, gameState: gs, territoryPositions: tp }) {
  game = g;
  gameState = gs;
  territoryPositions = tp;
  elementCache.clear();
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }
  resizeHandler = () => updateUI();
  window.addEventListener("resize", resizeHandler);
}

function getSelectedCards() {
  return selectedCards;
}

function resetSelectedCards() {
  selectedCards = [];
}

function formatPlayerName(player) {
  if (!player.ai) return player.name;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const diff = cap(player.difficulty || "normal");
  const style = cap(player.style || "balanced");
  return `${player.name} (${diff}/${style})`;
}

function updateInfoPanel() {
  const cp = getElement("currentPlayer");
  if (cp) cp.textContent = formatPlayerName(game.players[gameState.currentPlayer]);
  const tn = getElement("turnNumber");
  if (tn) tn.textContent = gameState.turnNumber;
}

function highlightTerritories(ids) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("highlight");
      setTimeout(() => el.classList.remove("highlight"), 1000);
    }
  });
}

function addLogEntry(entry, meta = {}) {
  const logEntry =
    typeof entry === "string" ? { message: entry, ...meta } : entry;
  if (logEntry.turn == null) logEntry.turn = gameState?.turnNumber;
  gameState.log.push(logEntry);
  const logEl = getElement("actionLog");
  if (logEl) {
    // rebuild log using DOM nodes to avoid innerHTML
    while (logEl.firstChild) logEl.removeChild(logEl.firstChild);
    const fragment = document.createDocumentFragment();
    const recent = gameState.log.slice(-10);
    recent.forEach((l) => {
      const div = document.createElement("div");
      div.textContent = l.message;
      if (l.territories && l.territories.length) {
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = " go to move";
        link.addEventListener("click", (e) => {
          e.preventDefault();
          highlightTerritories(l.territories);
        });
        div.appendChild(link);
      }
      fragment.appendChild(div);
    });
    logEl.appendChild(fragment);
    logEl.scrollTop = logEl.scrollHeight;
  }
  return logEntry;
}

function getLog(filter = {}) {
  if (!filter.player && !filter.type && !filter.turn) {
    return gameState.log;
  }
  return gameState.log.filter((e) => {
    if (filter.player != null && e.player !== filter.player) return false;
    if (filter.type && e.type !== filter.type) return false;
    if (filter.turn != null && e.turn !== filter.turn) return false;
    return true;
  });
}

function exportLog(format = "json", filter) {
  const entries = getLog(filter);
  if (format === "json") {
    return JSON.stringify(entries);
  }
  if (format === "csv") {
    const header = ["turn", "player", "type", "message", "territories"].join(",");
    const rows = entries.map((e) =>
      [
        e.turn,
        e.player || "",
        e.type || "",
        `"${e.message.replace(/"/g, '""')}"`,
        (e.territories || []).join("|")
      ].join(","),
    );
    return [header, ...rows].join("\n");
  }
  throw new Error("Unsupported format");
}

async function copyLog(format = "json", filter) {
  const data = exportLog(format, filter);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(data);
  }
  return data;
}

function animateMove(from, to) {
  const board = getElement("board");
  if (!board) return;
  const fromPos = territoryPositions[from];
  const toPos = territoryPositions[to];
  if (!fromPos || !toPos) return;
  const token = document.createElement("div");
  token.className = "token move-token";
  const scale = getBoardScale();
  token.style.left = fromPos.x * scale.x + "px";
  token.style.top = fromPos.y * scale.y + "px";
  board.appendChild(token);
  requestAnimationFrame(() => {
    token.style.left = toPos.x * scale.x + "px";
    token.style.top = toPos.y * scale.y + "px";
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
  const modal = getElement("victoryModal");
  if (!modal) return;
  const title = getElement("victoryTitle");
  const statsEl = getElement("victoryStats");
  if (title) title.textContent = `${game.players[winnerIdx].name} has won!`;
  if (statsEl) {
    while (statsEl.firstChild) statsEl.removeChild(statsEl.firstChild);
    const turns = document.createElement("p");
    turns.textContent = `Turns: ${gameState.turnNumber}`;
    statsEl.appendChild(turns);
    const duration = getStats().startTime
      ? Math.round((Date.now() - getStats().startTime) / 1000)
      : 0;
    const durationEl = document.createElement("p");
    durationEl.textContent = `Duration: ${duration}s`;
    statsEl.appendChild(durationEl);
    const ranking = game.players
      .map((p, idx) => ({
        name: p.name,
        territories: game.territories.filter((t) => t.owner === idx).length,
      }))
      .sort((a, b) => b.territories - a.territories);
    const ol = document.createElement("ol");
    ranking.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = `${r.name}: ${r.territories} territories`;
      ol.appendChild(li);
    });
    statsEl.appendChild(ol);
    const s = getStats();
    if (s.territories.length && typeof window !== 'undefined' && window.Chart) {
      const labels = s.territories[0].map((_, i) => `Turn ${i + 1}`);
      const terrCtx = document
        .getElementById("territoryChart")
        ?.getContext("2d");
      if (terrCtx) {
        new window.Chart(terrCtx, {
          type: "line",
          data: {
            labels,
            datasets: game.players.map((p, idx) => ({
              label: p.name,
              data: s.territories[idx],
              fill: false,
            })),
          },
          options: { responsive: true },
        });
      }
      const armCtx = document
        .getElementById("armiesChart")
        ?.getContext("2d");
      if (armCtx) {
        new window.Chart(armCtx, {
          type: "line",
          data: {
            labels,
            datasets: game.players.map((p, idx) => ({
              label: p.name,
              data: s.armies[idx],
              fill: false,
            })),
          },
          options: { responsive: true },
        });
      }
      const attCtx = document
        .getElementById("attackChart")
        ?.getContext("2d");
      if (attCtx) {
        const wins = s.attacksWon.map((a) => a.reduce((sum, n) => sum + n, 0));
        const losses = s.attacksLost.map((a) => a.reduce((sum, n) => sum + n, 0));
        new window.Chart(attCtx, {
          type: "bar",
          data: {
            labels: game.players.map((p) => p.name),
            datasets: [
              { label: "Wins", data: wins, backgroundColor: "#4caf50" },
              { label: "Losses", data: losses, backgroundColor: "#f44336" },
            ],
          },
          options: { responsive: true },
        });
      }
    }
  }
  modal.classList.add("show");
}

function updateBonusInfo() {
  const bonusEl = getElement("bonusInfo");
  if (!bonusEl) return;
  const bonuses = game.continents
    .filter((c) =>
      c.territories.every((id) => game.territoryById(id).owner === game.currentPlayer),
    )
    .map((c) => `${c.name} +${c.bonus}`);
  bonusEl.textContent = bonuses.length ? `Bonus: ${bonuses.join(", ")}` : "";
}

function updateCardsUI() {
  const container = getElement("cards");
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  const hand = game.hands[game.currentPlayer] || [];
  selectedCards = [];
  const icons = { infantry: "🪖", cavalry: "🐎", artillery: "💣" };
  hand.forEach((card, idx) => {
    const el = document.createElement("span");
    el.innerHTML = icons[card.type] || card.type;
    el.dataset.idx = idx;
    el.className = `card ${card.type}`;
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

let colorStyleSheet;
function getColorClass(color) {
  if (!colorStyleSheet) {
    const styleEl = document.createElement("style");
    document.head.appendChild(styleEl);
    colorStyleSheet = styleEl.sheet;
  }
  const testEl = document.createElement("div");
  testEl.style.color = color;
  if (!testEl.style.color) return null;
  const className = `player-color-${color.replace(/[^a-z0-9]/gi, "")}`;
  const selector = `.${className}`;
  const exists = Array.from(colorStyleSheet.cssRules).some(
    (r) => r.selectorText === selector,
  );
  if (!exists) {
    const textColor = getContrastingColor(color);
    colorStyleSheet.insertRule(
      `${selector}{background:${color};color:${textColor};}`,
      colorStyleSheet.cssRules.length,
    );
  }
  return className;
}

function cleanupColorClasses(activeClasses) {
  if (!colorStyleSheet) return;
  const allowed = new Set(activeClasses.map((c) => `.${c}`));
  for (let i = colorStyleSheet.cssRules.length - 1; i >= 0; i--) {
    const rule = colorStyleSheet.cssRules[i];
    const sel = rule.selectorText;
    if (sel && sel.startsWith(".player-color-") && !allowed.has(sel)) {
      colorStyleSheet.deleteRule(i);
    }
  }
  if (colorStyleSheet.cssRules.length === 0) {
    colorStyleSheet.ownerNode.remove();
    colorStyleSheet = null;
  }
}

function updateTerritories(scale, playerColorClasses) {
  game.territories.forEach((t) => {
    const el = getElement(t.id);
    if (!el) return;

    const colorClass = playerColorClasses[t.owner];
    const colorClasses = Array.from(el.classList).filter((c) =>
      c.startsWith("player-color-"),
    );
    colorClasses.forEach((c) => el.classList.remove(c));
    if (colorClass) {
      el.classList.add(colorClass);
    }

    el.textContent = t.armies;
    const pos = territoryPositions[t.id];
    if (pos) {
      el.style.left = pos.x * scale.x + "px";
      el.style.top = pos.y * scale.y + "px";
    }
    el.classList.remove("selected");
  });
}

function updateToken(scale) {
  if (!gameState.tokenPosition) return;
  const token = getElement("token");
  if (token) {
    token.style.left = gameState.tokenPosition.x * scale.x + "px";
    token.style.top = gameState.tokenPosition.y * scale.y + "px";
  }
}

function updateStatus() {
  let status = `${game.players[game.currentPlayer].name} - ${game.getPhase()}`;
  if (game.getPhase() === REINFORCE) {
    status += ` (${game.reinforcements} reinforcements)`;
  }
  const statusEl = getElement("status");
  if (statusEl) statusEl.textContent = status;
}

function updateUI() {
  const scale = getBoardScale();
  const playerColorClasses = game.players.map((p) => getColorClass(p.color));
  cleanupColorClasses(playerColorClasses.filter(Boolean));
  updateTerritories(scale, playerColorClasses);
  updateToken(scale);
  updateStatus();
  updateBonusInfo();
  updateCardsUI();
}

function destroyUI() {
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  elementCache.clear();
}

  export {
    initUI,
    updateInfoPanel,
    addLogEntry,
    animateMove,
    showVictoryModal,
    updateBonusInfo,
    updateCardsUI,
    updateUI,
    destroyUI,
    getSelectedCards,
    resetSelectedCards,
    getBoardScale,
    getLog,
    exportLog,
    copyLog,
  };
