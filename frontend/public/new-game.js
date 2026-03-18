const state = {
  maps: [],
  sessionToken: localStorage.getItem("frontline-session-token") || null,
  user: null,
  creating: false
};

const elements = {
  authStatus: document.querySelector("#setup-auth-status"),
  feedback: document.querySelector("#new-game-feedback"),
  form: document.querySelector("#new-game-form"),
  gameName: document.querySelector("#setup-game-name"),
  logoutButton: document.querySelector("#logout-button"),
  map: document.querySelector("#setup-map"),
  playerSlots: document.querySelector("#setup-player-slots"),
  submit: document.querySelector("#submit-new-game"),
  totalPlayers: document.querySelector("#setup-total-players")
};

function renderNavAvatar(username) {
  const avatar = document.querySelector("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

function slotMarkup(index) {
  return '<div class="setup-slot" data-slot-index="' + index + '">' +
    '<div class="setup-slot-head"><strong>Player ' + (index + 1) + '</strong></div>' +
    '<label class="field-stack"><span>Tipo</span><select data-role="type"><option value="human">Human</option><option value="ai">AI</option></select></label>' +
    '<label class="field-stack"><span>Nome</span><input data-role="name" maxlength="24" placeholder="Player ' + (index + 1) + '" /></label>' +
  '</div>';
}

function renderSlots() {
  const total = Number(elements.totalPlayers.value || 2);
  elements.playerSlots.innerHTML = Array.from({ length: total }, (_, index) => slotMarkup(index)).join("");
}

function setFeedback(message, type = "") {
  elements.feedback.className = "session-feedback" + (type === "error" ? " is-error" : "") + (message ? "" : " is-hidden");
  elements.feedback.textContent = message || "";
}

function readConfig() {
  const totalPlayers = Number(elements.totalPlayers.value || 2);
  const players = Array.from(elements.playerSlots.querySelectorAll("[data-slot-index]"))
    .map((slot, index) => ({
      type: slot.querySelector('[data-role="type"]').value,
      name: slot.querySelector('[data-role="name"]').value.trim() || undefined,
      slot: index + 1
    }));

  return {
    name: elements.gameName.value.trim() || undefined,
    mapId: elements.map.value,
    totalPlayers,
    players
  };
}

async function send(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Richiesta fallita.");
  }
  return data;
}

async function loadOptions() {
  const response = await fetch("/api/game-options");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Impossibile caricare le opzioni di creazione.");
  }

  state.maps = data.maps || [];
  elements.map.innerHTML = state.maps.map((map) => '<option value="' + map.id + '">' + map.name + '</option>').join("");
}

async function restoreSession() {
  if (!state.sessionToken) {
    renderNavAvatar();
    elements.logoutButton.hidden = true;
    elements.authStatus.textContent = "Configurazione locale pronta.";
    return;
  }

  try {
    const response = await fetch("/api/auth/session", {
      headers: { "x-session-token": state.sessionToken }
    });

    if (!response.ok) {
      throw new Error("Sessione scaduta");
    }

    const data = await response.json();
    state.user = data.user;
  } catch (error) {
    state.user = null;
    state.sessionToken = null;
    localStorage.removeItem("frontline-session-token");
  }

  elements.logoutButton.hidden = !state.user;
  elements.authStatus.textContent = state.user ? "Comandante: " + state.user.username : "Configurazione locale pronta.";
  renderNavAvatar(state.user && state.user.username);
}

elements.totalPlayers.addEventListener("change", renderSlots);

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.creating) {
    return;
  }

  state.creating = true;
  elements.submit.disabled = true;
  setFeedback("Creazione partita in corso...");

  try {
    const data = await send("/api/games", readConfig());
    window.location.href = "/game.html?gameId=" + encodeURIComponent(data.game.id);
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    state.creating = false;
    elements.submit.disabled = false;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await send("/api/auth/logout", { sessionToken: state.sessionToken });
  } catch (error) {
  }

  state.user = null;
  state.sessionToken = null;
  localStorage.removeItem("frontline-session-token");
  elements.logoutButton.hidden = true;
  elements.authStatus.textContent = "Configurazione locale pronta.";
  renderNavAvatar();
});

await loadOptions();
renderSlots();
await restoreSession();
