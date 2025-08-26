import { colorPalette } from "./colors.js";
import { initThemeToggle } from "./theme.js";
import { navigateTo } from "./navigation.js";

const form = document.getElementById("setupForm");
const humanCountInput = document.getElementById("humanCount");
const aiCountInput = document.getElementById("aiCount");
const aiDifficultyInput = document.getElementById("aiDifficulty");
const aiStyleInput = document.getElementById("aiStyle");
const playersContainer = document.getElementById("players");
const mapSelect = document.getElementById("mapSelect");
const mapGrid = document.getElementById("mapGrid");

const thumbnailCache = new Map();
let selectedMap = null;

function getCachedImage(src) {
  if (thumbnailCache.has(src)) {
    return thumbnailCache.get(src).cloneNode(true);
  }
  const img = document.createElement("img");
  img.src = src;
  thumbnailCache.set(src, img);
  return img.cloneNode(true);
}

export async function loadMapData() {
  if (!mapGrid) return;
  const res = await fetch("./map-manifest.json");
  const data = await res.json();
  mapGrid.innerHTML = "";
  mapGrid.style.display = "grid";
  mapGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
  data.maps.forEach((m) => {
    const item = document.createElement("div");
    item.className = "map-item";
    item.dataset.id = m.id;
    const img = getCachedImage(m.thumbnail);
    img.alt = m.name;
    img.addEventListener("error", () => {
      item.classList.add("missing");
      item.innerHTML = '<div class="placeholder">No preview</div>';
    });
    item.appendChild(img);
    const name = document.createElement("h3");
    name.textContent = m.name;
    item.appendChild(name);
    const diff = document.createElement("p");
    diff.textContent = `Difficulty: ${m.difficulty}`;
    item.appendChild(diff);
    const terr = document.createElement("p");
    terr.textContent = `Territories: ${m.territories}`;
    item.appendChild(terr);
    const bonus = document.createElement("p");
    bonus.textContent =
      "Bonuses: " +
      Object.entries(m.bonuses || {})
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");
    item.appendChild(bonus);
    const detail = document.createElement("div");
    detail.className = "map-detail hidden";
    detail.innerHTML = `<p>${m.description || ""}</p>`;
    const layout = getCachedImage(m.thumbnail);
    layout.alt = `${m.name} layout`;
    layout.className = "layout";
    detail.appendChild(layout);
    item.appendChild(detail);
    item.addEventListener("mouseenter", () => detail.classList.remove("hidden"));
    item.addEventListener("mouseleave", () => detail.classList.add("hidden"));
    item.addEventListener("click", () => {
      selectedMap = m.id;
      if (mapSelect) mapSelect.value = m.id;
      document
        .querySelectorAll(".map-item.selected")
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
    });
    if (selectedMap === m.id) {
      item.classList.add("selected");
    }
    mapGrid.appendChild(item);
  });
}

function renderPlayerInputs(humanCount) {
  playersContainer.innerHTML = "";
  for (let i = 0; i < humanCount; i += 1) {
    const wrapper = document.createElement("div");
    const options = colorPalette
      .map(
        (c, idx) =>
          `<option value="${c}" ${idx === i ? "selected" : ""}>${c}</option>`
      )
      .join("");
    wrapper.innerHTML = `
      <label>Player Name ${i + 1}: <input type="text" id="name${i}" required /></label>
      <label>Color: <select id="color${i}" required>${options}</select></label>
    `;
    playersContainer.appendChild(wrapper);
  }
}

function loadFromStorage() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem("netriskPlayers"));
  } catch (err) {
    saved = null;
  }
  let humanCount = 1;
  let aiCount = 2;
  if (saved && Array.isArray(saved)) {
    humanCount = saved.filter((p) => !p.ai).length;
    aiCount = saved.filter((p) => p.ai).length;
    const firstAI = saved.find((p) => p.ai);
    if (firstAI) {
      if (aiDifficultyInput) aiDifficultyInput.value = firstAI.difficulty || "normal";
      if (aiStyleInput) aiStyleInput.value = firstAI.style || "balanced";
    }
  }
  humanCountInput.value = humanCount;
  aiCountInput.value = aiCount;
  let savedMap = null;
  try {
    savedMap = localStorage.getItem("netriskMap");
  } catch {
    savedMap = null;
  }
  if (savedMap && mapSelect) {
    mapSelect.value = savedMap;
    selectedMap = savedMap;
  }
  renderPlayerInputs(humanCount);
  if (saved) {
    saved.filter((p) => !p.ai).forEach((p, i) => {
      const nameInput = document.getElementById(`name${i}`);
      const colorInput = document.getElementById(`color${i}`);
      if (nameInput) nameInput.value = p.name;
      if (colorInput) colorInput.value = p.color;
    });
  }
}

humanCountInput.addEventListener("change", () => {
  const count = parseInt(humanCountInput.value, 10);
  if (Number.isNaN(count) || count < 1) return;
  renderPlayerInputs(count);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const humanCount = parseInt(humanCountInput.value, 10) || 0;
  const aiCount = parseInt(aiCountInput.value, 10) || 0;
  const difficulty = aiDifficultyInput ? aiDifficultyInput.value : "normal";
  const style = aiStyleInput ? aiStyleInput.value : "balanced";
  const players = [];
  const usedColors = new Set();
  for (let i = 0; i < humanCount; i += 1) {
    const name = document.getElementById(`name${i}`).value || `Player ${i + 1}`;
    const color = document.getElementById(`color${i}`).value || colorPalette[0];
    if (usedColors.has(color)) {
      window.alert("Player colors must be unique");
      return;
    }
    usedColors.add(color);
    players.push({ name, color });
  }
  for (let i = 0; i < aiCount; i += 1) {
    const color = colorPalette.find((c) => !usedColors.has(c)) || colorPalette[0];
    usedColors.add(color);
    players.push({ name: `AI ${i + 1}`, color, ai: true, difficulty, style });
  }
  try {
    localStorage.setItem("netriskPlayers", JSON.stringify(players));
    if (mapSelect) {
      localStorage.setItem("netriskMap", mapSelect.value);
    }
  } catch (err) {
    // ignore storage errors
  }
  navigateTo("index.html");
});

loadFromStorage();
initThemeToggle();
export const mapLoadPromise = loadMapData();
