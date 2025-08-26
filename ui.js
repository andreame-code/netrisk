import { getContrastingColor } from "./colors.js";
import { REINFORCE } from "./phases.js";

let game;
let gameState;
let territoryPositions = {};
let selectedCards = [];

function initUI({ game: g, gameState: gs, territoryPositions: tp }) {
  game = g;
  gameState = gs;
  territoryPositions = tp;
}

function getSelectedCards() {
  return selectedCards;
}

function resetSelectedCards() {
  selectedCards = [];
}

function updateInfoPanel() {
  const cp = document.getElementById("currentPlayer");
  if (cp) cp.textContent = game.players[gameState.currentPlayer].name;
  const tn = document.getElementById("turnNumber");
  if (tn) tn.textContent = gameState.turnNumber;
}

function addLogEntry(msg) {
  gameState.log.push(msg);
  if (gameState.log.length > 10) gameState.log.shift();
  const logEl = document.getElementById("actionLog");
  if (logEl) {
    logEl.innerHTML = gameState.log.map((l) => `<div>${l}</div>`).join("");
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function animateMove(from, to) {
  const board = document.getElementById("board");
  if (!board) return;
  const fromPos = territoryPositions[from];
  const toPos = territoryPositions[to];
  if (!fromPos || !toPos) return;
  const token = document.createElement("div");
  token.className = "token move-token";
  token.style.left = fromPos.x + "px";
  token.style.top = fromPos.y + "px";
  board.appendChild(token);
  requestAnimationFrame(() => {
    token.style.left = toPos.x + "px";
    token.style.top = toPos.y + "px";
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
  const modal = document.getElementById("victoryModal");
  if (!modal) return;
  const title = document.getElementById("victoryTitle");
  const stats = document.getElementById("victoryStats");
  if (title) title.textContent = `${game.players[winnerIdx].name} ha vinto!`;
  if (stats) {
    const terr = game.players.map((p, idx) => {
      const count = game.territories.filter((t) => t.owner === idx).length;
      return `<li>${p.name}: ${count} territori</li>`;
    });
    stats.innerHTML = `<p>Turni: ${gameState.turnNumber}</p><ul>${terr.join("")}</ul>`;
  }
  modal.classList.add("show");
}

function updateBonusInfo() {
  const bonusEl = document.getElementById("bonusInfo");
  if (!bonusEl) return;
  const bonuses = game.continents
    .filter((c) =>
      c.territories.every((id) => game.territoryById(id).owner === game.currentPlayer),
    )
    .map((c) => `${c.name} +${c.bonus}`);
  bonusEl.textContent = bonuses.length ? `Bonus: ${bonuses.join(", ")}` : "";
}

function updateCardsUI() {
  const container = document.getElementById("cards");
  if (!container) return;
  container.innerHTML = "";
  const hand = game.hands[game.currentPlayer] || [];
  selectedCards = [];
  hand.forEach((card, idx) => {
    const el = document.createElement("span");
    el.textContent = card.type;
    el.dataset.idx = idx;
    el.className = "card";
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

function updateUI() {
  game.territories.forEach((t) => {
    const el = document.getElementById(t.id);
    if (!el) return;

    const color = game.players[t.owner].color;
    el.style.background = "";
    el.style.background = color;
    if (el.style.background) {
      el.style.color = getContrastingColor(color);
    } else {
      el.style.color = "";
    }

    el.textContent = t.armies;
    const pos = territoryPositions[t.id];
    if (pos) {
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
    }
    el.classList.remove("selected");
  });
  let status = `${game.players[game.currentPlayer].name} - ${game.getPhase()}`;
  if (game.getPhase() === REINFORCE) {
    status += ` (${game.reinforcements} reinforcements)`;
  }
  document.getElementById("status").textContent = status;
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
};
