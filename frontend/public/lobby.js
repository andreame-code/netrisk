const state = {
  currentGameId: null,
  selectedGameId: null,
  gameList: [],
  gameListState: "loading",
  gameListError: "",
  sessionToken: localStorage.getItem("frontline-session-token") || null,
  user: null
};

const elements = {
  createGameButton: document.querySelector("#create-game-button"),
  openGameButton: document.querySelector("#open-game-button"),
  gameStatus: document.querySelector("#game-status"),
  authStatus: document.querySelector("#auth-status"),
  logoutButton: document.querySelector("#logout-button"),
  gameListState: document.querySelector("#game-list-state"),
  gameSessionList: document.querySelector("#game-session-list"),
  gameSessionDetails: document.querySelector("#game-session-details"),
  selectedGameStatus: document.querySelector("#selected-game-status")
};

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

function updateGameSelection(gameId) {
  state.selectedGameId = gameId || null;
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
          '<span class="session-name" data-open-game-id="' + game.id + '" role="link" tabindex="0">' + game.name + '</span>' +
          '<span class="session-sub">Sessione ' + game.id.slice(0, 8) + '</span>' +
        '</span>' +
        '<span class="session-cell-muted">' + game.id + '</span>' +
        '<span class="badge' + (game.id === state.currentGameId ? ' accent' : '') + '">' + phaseLabel(game.phase) + '</span>' +
        '<span class="session-cell-muted">' + game.playerCount + '/4</span>' +
        '<span class="session-cell-muted">' + formatUpdatedTime(game.updatedAt) + '</span>' +
      '</button>'
    )
    .join("");

  elements.authStatus.textContent = state.user
    ? "Autenticato come " + state.user.username + ". Usa Game per entrare nella partita attiva."
    : "Accedi dalla pagina Game per collegarti e poi torna qui per gestire le sessioni.";
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
        '<h4 class="session-detail-title">' + selected.name + '</h4>' +
        '<p class="session-detail-copy">' + readinessLabel(selected) + '. Stato corrente: ' + phaseLabel(selected.phase) + '.</p>' +
      '</div>' +
      '<div class="session-detail-grid">' +
        '<div class="session-detail-item"><span>Nome</span><strong>' + selected.name + '</strong></div>' +
        '<div class="session-detail-item"><span>ID</span><strong>' + selected.id + '</strong></div>' +
        '<div class="session-detail-item"><span>Stato</span><strong>' + phaseLabel(selected.phase) + '</strong></div>' +
        '<div class="session-detail-item"><span>Giocatori presenti</span><strong>' + selected.playerCount + '/4</strong></div>' +
        '<div class="session-detail-item"><span>Giocatori configurati</span><strong>' + (selected.totalPlayers || 'n/d') + '</strong></div>' +
        '<div class="session-detail-item"><span>Mappa</span><strong>' + (selected.mapName || selected.mapId || 'Classic Mini') + '</strong></div>' +
        '<div class="session-detail-item"><span>AI</span><strong>' + (selected.aiCount || 0) + '</strong></div>' +
        '<div class="session-detail-item"><span>Ultimo update</span><strong>' + formatUpdatedTime(selected.updatedAt) + '</strong></div>' +
        '<div class="session-detail-item"><span>Focus</span><strong>' + sessionFocusLabel(selected) + '</strong></div>' +
      '</div>' +
      '<div class="session-detail-note">La Lobby gestisce creazione, selezione e apertura. Il tabellone Game resta dedicato al comando della partita attiva.</div>' +
      '<div class="session-detail-actions"><button type="button" id="open-selected-inline">Apri nel teatro di guerra</button></div>'
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

async function loadGameList() {
  state.gameListState = "loading";
  state.gameListError = "";
  render();

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

  render();
}

async function openGameById(gameId) {
  const data = await send("/api/games/open", { gameId });
  state.gameList = data.games || [];
  state.currentGameId = data.activeGameId || null;
  updateGameSelection(state.currentGameId);
  state.gameListState = state.gameList.length ? "ready" : "empty";
  render();
  window.location.href = "/game.html?gameId=" + encodeURIComponent(gameId);
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

elements.openGameButton.addEventListener("click", handleOpenSelectedGame);
elements.gameSessionList.addEventListener("click", (event) => {
  const gameNameTrigger = event.target.closest("[data-open-game-id]");
  if (gameNameTrigger) {
    event.stopPropagation();
    window.location.href = "/game/" + encodeURIComponent(gameNameTrigger.dataset.openGameId);
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
  const trigger = event.target.closest("#open-selected-inline");
  if (!trigger) {
    return;
  }

  handleOpenSelectedGame();
});

await loadGameList();
await restoreSession();

async function restoreSession() {
  if (!state.sessionToken) {
    render();
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

  render();
}

elements.logoutButton.addEventListener("click", async () => {
  try {
    await send("/api/auth/logout", { sessionToken: state.sessionToken });
  } catch (error) {
  }

  state.user = null;
  state.sessionToken = null;
  localStorage.removeItem("frontline-session-token");
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