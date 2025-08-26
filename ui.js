import { getContrastingColor } from "./colors.js";
import { REINFORCE } from "./phases.js";

const BOARD_WIDTH = 600;
const BOARD_HEIGHT = 400;

// cache DOM lookups to avoid repetitive queries
const elementCache = {};
function getElement(id) {
  if (!elementCache[id]) {
    elementCache[id] = document.getElementById(id);
  }
  return elementCache[id];
}

function getBoardScale() {
  const board = getElement("board");
  if (!board) return { x: 1, y: 1 };
  const rect = board.getBoundingClientRect();
  const x = rect.width ? rect.width / BOARD_WIDTH : 1;
  const y = rect.height ? rect.height / BOARD_HEIGHT : 1;
  return { x, y };
}

let game;
let gameState;
let territoryPositions = {};
let selectedCards = [];

function initUI({ game: g, gameState: gs, territoryPositions: tp }) {
  game = g;
  gameState = gs;
  territoryPositions = tp;
  Object.keys(elementCache).forEach((k) => delete elementCache[k]);
  window.addEventListener("resize", updateUI);
}

function getSelectedCards() {
  return selectedCards;
}

function resetSelectedCards() {
  selectedCards = [];
}

function updateInfoPanel() {
  const cp = getElement("currentPlayer");
  if (cp) cp.textContent = game.players[gameState.currentPlayer].name;
  const tn = getElement("turnNumber");
  if (tn) tn.textContent = gameState.turnNumber;
}

function addLogEntry(msg) {
  gameState.log.push(msg);
  if (gameState.log.length > 10) gameState.log.shift();
  const logEl = getElement("actionLog");
  if (logEl) {
    // rebuild log using DOM nodes to avoid innerHTML
    while (logEl.firstChild) logEl.removeChild(logEl.firstChild);
    const fragment = document.createDocumentFragment();
    gameState.log.forEach((l) => {
      const div = document.createElement("div");
      div.textContent = l;
      fragment.appendChild(div);
    });
    logEl.appendChild(fragment);
    logEl.scrollTop = logEl.scrollHeight;
  }
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
  const stats = getElement("victoryStats");
  if (title) title.textContent = `${game.players[winnerIdx].name} has won!`;
  if (stats) {
    // clear previous stats
    while (stats.firstChild) stats.removeChild(stats.firstChild);

    const turns = document.createElement("p");
    turns.textContent = `Turns: ${gameState.turnNumber}`;
    stats.appendChild(turns);

    const ul = document.createElement("ul");
    game.players.forEach((p, idx) => {
      const count = game.territories.filter((t) => t.owner === idx).length;
      const li = document.createElement("li");
      li.textContent = `${p.name}: ${count} territories`;
      ul.appendChild(li);
    });
    stats.appendChild(ul);
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

function updateUI() {
  const scale = getBoardScale();
  const playerColorClasses = game.players.map((p) => getColorClass(p.color));
  cleanupColorClasses(playerColorClasses.filter(Boolean));
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
  if (gameState.tokenPosition) {
    const token = getElement("token");
    if (token) {
      token.style.left = gameState.tokenPosition.x * scale.x + "px";
      token.style.top = gameState.tokenPosition.y * scale.y + "px";
    }
  }
  let status = `${game.players[game.currentPlayer].name} - ${game.getPhase()}`;
  if (game.getPhase() === REINFORCE) {
    status += ` (${game.reinforcements} reinforcements)`;
  }
  const statusEl = getElement("status");
  if (statusEl) statusEl.textContent = status;
  updateBonusInfo();
  updateCardsUI();
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
  getSelectedCards,
  resetSelectedCards,
  getBoardScale,
};
