import { colorPalette } from "./colors.js";

const form = document.getElementById("setupForm");
const humanCountInput = document.getElementById("humanCount");
const aiCountInput = document.getElementById("aiCount");
const playersContainer = document.getElementById("players");

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
      <label>Nome Giocatore ${i + 1}: <input type="text" id="name${i}" /></label>
      <label>Colore: <select id="color${i}">${options}</select></label>
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
  let humanCount = 2;
  let aiCount = 1;
  if (saved && Array.isArray(saved)) {
    humanCount = saved.filter((p) => !p.ai).length;
    aiCount = saved.filter((p) => p.ai).length;
  }
  humanCountInput.value = humanCount;
  aiCountInput.value = aiCount;
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
  const players = [];
  const usedColors = new Set();
  for (let i = 0; i < humanCount; i += 1) {
    const name = document.getElementById(`name${i}`).value || `Player ${i + 1}`;
    const color = document.getElementById(`color${i}`).value || colorPalette[0];
    if (usedColors.has(color)) {
      window.alert("I colori dei giocatori devono essere unici");
      return;
    }
    usedColors.add(color);
    players.push({ name, color });
  }
  for (let i = 0; i < aiCount; i += 1) {
    const color = colorPalette.find((c) => !usedColors.has(c)) || colorPalette[0];
    usedColors.add(color);
    players.push({ name: `AI ${i + 1}`, color, ai: true });
  }
  try {
    localStorage.setItem("netriskPlayers", JSON.stringify(players));
  } catch (err) {
    // ignore storage errors
  }
  window.location.href = "index.html";
});

loadFromStorage();
