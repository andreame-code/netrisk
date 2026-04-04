const state = {
  currentGameId: null,
  selectedGameId: null,
  gameList: [],
  gameListState: "loading",
  gameListError: "",
  user: null
};

const elements = {
  createGameButton: document.querySelector("#create-game-button"),
  openGameButton: document.querySelector("#open-game-button"),
  gameStatus: document.querySelector("#game-status"),
  headerLoginForm: document.querySelector("#header-login-form"),
  headerAuthUsername: document.querySelector("#header-auth-username"),
  headerAuthPassword: document.querySelector("#header-auth-password"),
  headerLoginButton: document.querySelector("#header-login-button"),
  authStatus: document.querySelector("#auth-status"),
  logoutButton: document.querySelector("#logout-button"),
  gameListState: document.querySelector("#game-list-state"),
  gameSessionList: document.querySelector("#game-session-list"),
  gameSessionDetails: document.querySelector("#game-session-details"),
  selectedGameStatus: document.querySelector("#selected-game-status")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderNavAvatar(username) {
  const avatar = document.querySelector("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

function formatUpdatedTime(value) {
  if (!value) {
    return "n/d";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "n/d";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function phaseLabel(phase) {
  if (phase === "active") {
    return "In corso";
  }
  if (phase === "finished") {
    return "Conclusa";
  }
  return "Lobby";
}

function readinessLabel(game) {
  if (game.phase === "finished") {
    return "Archivio campagna";
  }
  if (game.phase === "active") {
    return "Teatro operativo aperto";
  }
  if (game.playerCount >= 2) {
    return "Pronta all'avvio";
  }
  return "In attesa rinforzi";
}

function sessionFocusLabel(game) {
  return game.id === state.currentGameId ? "Sessione aperta" : "Disponibile";
}

function selectedGame() {
  const selectedId = state.selectedGameId || state.currentGameId;
  return state.gameList.find((game) => game.id === selectedId) || null;
}

function canJoinGame(game) {
  if (!game || !state.user) {
    return false;
  }

  if (game.phase !== "lobby") {
    return false;
  }

  const maxPlayers = Number.isInteger(game.totalPlayers) && game.totalPlayers > 0
    ? game.totalPlayers
    : 4;

  return game.playerCount < maxPlayers;
}

function gameCapacityLabel(game) {
  const maxPlayers = Number.isInteger(game?.totalPlayers) && game.totalPlayers > 0
    ? game.totalPlayers
    : 4;

  return game.playerCount + "/" + maxPlayers;
}

function updateGameSelection(gameId) {
  state.selectedGameId = gameId || null;
}

function setSession(user) {
  state.user = user || null;
}

async function loginWithCredentials(username, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Accesso non riuscito.");
  }

  setSession(data.user);
  await loadGameList();
  render();
}

function render() {
  const selected = selectedGame();
  const selectedId = state.selectedGameId || state.currentGameId;
  const hasGames = state.gameList.length > 0;

  elements.gameListState.className = "session-feedback" + (state.gameListState === "error" ? " is-error" : "") + (hasGames ? " is-hidden" : "");
  if (state.gameListState === "loading") {
    elements.gameListState.textContent = "Caricamento sessioni...";
  } else if (state.gameListState === "error") {
    elements.gameListState.textContent = state.gameListError || "Impossibile caricare le partite.";
  } else {
    elements.gameListState.textContent = "Nessuna partita disponibile. Creane una nuova per iniziare.";
  }

  elements.gameSessionList.innerHTML = state.gameList
    .map((game) => 
      '<button type="button" class="session-row session-row-button' + (game.id === selectedId ? ' is-selected' : '') + '" data-game-id="' + game.id + '">' +
        '<span class="session-primary">' +
          '<span class="session-name" data-open-game-id="' + game.id + '" role="link" tabindex="0">' + escapeHtml(game.name) + '</span>' +
          '<span class="session-sub">Sessione ' + game.id.slice(0, 8) + '</span>' +
        '</span>' +
        '<span class="session-cell-muted">' + game.id + '</span>' +
        '<span class="badge' + (game.id === state.currentGameId ? ' accent' : '') + '">' + phaseLabel(game.phase) + '</span>' +
        '<span class="session-cell-muted">' + gameCapacityLabel(game) + '</span>' +
        '<span class="session-cell-muted">' + formatUpdatedTime(game.updatedAt) + '</span>' +
      '</button>'
    )
    .join("");

  elements.authStatus.textContent = state.user
    ? "Autenticato come " + state.user.username + ". Usa Game per entrare nella partita attiva."
    : "Accedi per aprire e gestire le tue sessioni.";
  if (elements.headerLoginForm) {
    const isAuthenticated = Boolean(state.user);
    elements.headerLoginForm.hidden = isAuthenticated;
    elements.headerAuthUsername.disabled = isAuthenticated;
    elements.headerAuthPassword.disabled = isAuthenticated;
    elements.headerLoginButton.disabled = isAuthenticated;
  }
  elements.logoutButton.hidden = !state.user;
  elements.logoutButton.disabled = !state.user;
  renderNavAvatar(state.user?.username);

  elements.selectedGameStatus.textContent = selected ? phaseLabel(selected.phase) : "Nessuna selezione";
  elements.gameStatus.textContent = state.currentGameId
    ? "Partita attiva: " + (((state.gameList.find((game) => game.id === state.currentGameId) || {}).name) || state.currentGameId)
    : "Nessuna partita attiva";

  elements.gameSessionDetails.innerHTML = selected
    ? '<div class="session-detail-hero">' +
        '<p class="session-detail-kicker">Sessione selezionata</p>' +
        '<h4 class="session-detail-title">' + escapeHtml(selected.name) + '</h4>' +
        '<p class="session-detail-copy">' + readinessLabel(selected) + '. Stato corrente: ' + phaseLabel(selected.phase) + '.</p>' +
      '</div>' +
      '<div class="session-detail-grid">' +
        '<div class="session-detail-item"><span>Nome</span><strong>' + escapeHtml(selected.name) + '</strong></div>' +
        '<div class="session-detail-item"><span>ID</span><strong>' + selected.id + '</strong></div>' +
        '<div class="session-detail-item"><span>Stato</span><strong>' + phaseLabel(selected.phase) + '</strong></div>' +
        '<div class="session-detail-item"><span>Giocatori presenti</span><strong>' + gameCapacityLabel(selected) + '</strong></div>' +
        '<div class="session-detail-item"><span>Giocatori configurati</span><strong>' + (selected.totalPlayers || 'n/d') + '</strong></div>' +
        '<div class="session-detail-item"><span>Mappa</span><strong>' + escapeHtml(selected.mapName || selected.mapId || 'Classic Mini') + '</strong></div>' +
        '<div class="session-detail-item"><span>AI</span><strong>' + (selected.aiCount || 0) + '</strong></div>' +
        '<div class="session-detail-item"><span>Ultimo update</span><strong>' + formatUpdatedTime(selected.updatedAt) + '</strong></div>' +
        '<div class="session-detail-item"><span>Focus</span><strong>' + sessionFocusLabel(selected) + '</strong></div>' +
      '</div>' +
      '<div class="session-detail-note">La Lobby gestisce creazione, selezione e apertura. Il tabellone Game resta dedicato al comando della partita attiva.</div>' +
      '<div class="session-detail-actions">' +
        '<button type="button" id="open-selected-inline">Apri nel teatro di guerra</button>' +
        (canJoinGame(selected) ? '<button type="button" id="join-selected-inline" class="ghost-button">Unisciti e apri</button>' : '') +
      '</div>'
    : '<div class="session-empty-copy">Seleziona una partita per vedere lo stato corrente, la prontezza operativa e aprirla nel tabellone di gioco.</div>';

  elements.openGameButton.disabled = !selected;
}

async function send(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Richiesta fallita.");
  }

  return data;
}

async function loadGameList(options = {}) {
  const renderOnChange = options.renderOnChange !== false;
  state.gameListState = "loading";
  state.gameListError = "";
  if (renderOnChange) {
    render();
  }

  try {
    const response = await fetch("/api/games");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Caricamento partite non riuscito.");
    }

    state.gameList = data.games || [];
    state.currentGameId = data.activeGameId || null;
    if (!state.selectedGameId || !state.gameList.some((game) => game.id === state.selectedGameId)) {
      updateGameSelection(state.currentGameId || state.gameList[0]?.id || null);
    }
    state.gameListState = state.gameList.length ? "ready" : "empty";
  } catch (error) {
    state.gameList = [];
    state.gameListState = "error";
    state.gameListError = error.message || "Impossibile caricare le partite.";
  }

  if (renderOnChange) {
    render();
  }
}

function navigateToGameRoute(gameId) {
  window.location.href = "/game/" + encodeURIComponent(gameId);
}

async function openGameById(gameId) {
  const data = await send("/api/games/open", { gameId });
  state.gameList = data.games || [];
  state.currentGameId = data.activeGameId || null;
  state.currentGameName = data.game?.name || null;
  updateGameSelection(state.currentGameId);
  state.gameListState = state.gameList.length ? "ready" : "empty";
  render();
  navigateToGameRoute(gameId);
}

async function handleOpenSelectedGame() {
  const selectedId = state.selectedGameId;
  if (!selectedId) {
    return;
  }

  try {
    await openGameById(selectedId);
  } catch (error) {
    state.gameListState = "error";
    state.gameListError = error.message;
    render();
    alert(error.message);
  }
}

async function handleJoinSelectedGame() {
  const selected = selectedGame();
  if (!selected || !canJoinGame(selected)) {
    return;
  }

  try {
    await send("/api/join", { gameId: selected.id });
    await openGameById(selected.id);
  } catch (error) {
    state.gameListState = "error";
    state.gameListError = error.message;
    render();
    alert(error.message);
  }
}

elements.openGameButton.addEventListener("click", handleOpenSelectedGame);
elements.gameSessionList.addEventListener("click", async (event) => {
  const gameNameTrigger = event.target.closest("[data-open-game-id]");
  if (gameNameTrigger) {
    event.stopPropagation();
    try {
      await openGameById(gameNameTrigger.dataset.openGameId);
    } catch (error) {
      state.gameListState = "error";
      state.gameListError = error.message;
      render();
      alert(error.message);
    }
    return;
  }

  const trigger = event.target.closest("[data-game-id]");
  if (!trigger) {
    return;
  }

  updateGameSelection(trigger.dataset.gameId);
  render();
});
elements.gameSessionDetails.addEventListener("click", (event) => {
  const joinTrigger = event.target.closest("#join-selected-inline");
  if (joinTrigger) {
    handleJoinSelectedGame();
    return;
  }

  const trigger = event.target.closest("#open-selected-inline");
  if (!trigger) {
    return;
  }

  handleOpenSelectedGame();
});

async function restoreSession(options = {}) {
  const renderOnChange = options.renderOnChange !== false;
  try {
    const response = await fetch("/api/auth/session");

    if (!response.ok) {
      throw new Error("Sessione scaduta");
    }

    const data = await response.json();
    setSession(data.user);
  } catch (error) {
    setSession(null);
  }

  if (renderOnChange) {
    render();
  }
}

await Promise.all([
  loadGameList({ renderOnChange: false }),
  restoreSession({ renderOnChange: false })
]);
render();

if (elements.headerLoginForm) {
  elements.headerLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = elements.headerAuthUsername.value.trim();
    const password = elements.headerAuthPassword.value;
    if (!username || !password) {
      return;
    }

    try {
      await loginWithCredentials(username, password);
      elements.headerAuthPassword.value = "";
    } catch (error) {
      alert(error.message);
    }
  });
}

elements.logoutButton.addEventListener("click", async () => {
  try {
    await send("/api/auth/logout", {});
  } catch (error) {
  }

  setSession(null);
  render();
});


elements.gameSessionList.addEventListener("keydown", (event) => {
  const gameNameTrigger = event.target.closest("[data-open-game-id]");
  if (!gameNameTrigger) {
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  window.location.href = "/game/" + encodeURIComponent(gameNameTrigger.dataset.openGameId);
});
