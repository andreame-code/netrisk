const form = document.getElementById("setupForm");
const playerCountInput = document.getElementById("playerCount");
const playersContainer = document.getElementById("players");

function renderPlayerInputs(count) {
  playersContainer.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <label>Nome Giocatore ${i + 1}: <input type="text" id="name${i}" /></label>
      <label>Colore: <input type="color" id="color${i}" /></label>
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
  const count = saved ? saved.length : 3;
  playerCountInput.value = count;
  renderPlayerInputs(count);
  if (saved) {
    saved.forEach((p, i) => {
      const nameInput = document.getElementById(`name${i}`);
      const colorInput = document.getElementById(`color${i}`);
      if (nameInput) nameInput.value = p.name;
      if (colorInput) colorInput.value = p.color;
    });
  }
}

playerCountInput.addEventListener("change", () => {
  const count = parseInt(playerCountInput.value, 10);
  if (Number.isNaN(count) || count < 2) return;
  renderPlayerInputs(count);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const count = parseInt(playerCountInput.value, 10);
  const players = [];
  for (let i = 0; i < count; i += 1) {
    const name = document.getElementById(`name${i}`).value || `Player ${i + 1}`;
    const color = document.getElementById(`color${i}`).value || "#000000";
    players.push({ name, color });
  }
  try {
    localStorage.setItem("netriskPlayers", JSON.stringify(players));
  } catch (err) {
    // ignore storage errors
  }
  window.location.href = "index.html";
});

loadFromStorage();
