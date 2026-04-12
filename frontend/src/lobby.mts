import { formatDate, t, translateServerMessage } from "./i18n.mts";

const VISIBLE_GAMES_BATCH_SIZE = 15;

const state = {
  currentGameId: null,
  selectedGameId: null,
  gameList: [],
  visibleGameCount: VISIBLE_GAMES_BATCH_SIZE,
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
  gameListLoadMoreState: document.querySelector("#game-list-load-more-state"),
  gameSessionDetails: document.querySelector("#game-session-details"),
  selectedGameStatus: document.querySelector("#selected-game-status"),
  lobbyTotalGames: document.querySelector("#lobby-total-games"),
  lobbyReadyGames: document.querySelector("#lobby-ready-games"),
  lobbyActiveFocus: document.querySelector("#lobby-active-focus"),
  lobbyFocusNote: document.querySelector("#lobby-focus-note")
};

let gameListObserver = null;

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
    return t("common.notAvailable");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return t("common.notAvailable");
  }

  return formatDate(parsed, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function phaseLabel(phase) {
  if (phase === "active") {
    return t("common.phase.active");
  }
  if (phase === "finished") {
    return t("common.phase.finished");
  }
  return t("common.phase.lobby");
}

function readinessLabel(game) {
  if (game.phase === "finished") {
    return t("lobby.readiness.archive");
  }
  if (game.phase === "active") {
    return t("lobby.readiness.active");
  }
  if (game.playerCount >= 2) {
    return t("lobby.readiness.ready");
  }
  return t("lobby.readiness.waiting");
}

function sessionFocusLabel(game) {
  return game.id === state.currentGameId ? t("lobby.focus.openSession") : t("lobby.focus.available");
}

function selectedGame() {
  const selectedId = state.selectedGameId || state.currentGameId;
  return state.gameList.find((game) => game.id === selectedId) || null;
}

function visibleGames() {
  return state.gameList.slice(0, state.visibleGameCount);
}

function canLoadMoreGames() {
  return state.visibleGameCount < state.gameList.length;
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
  window.netriskTheme?.applyUserTheme?.(state.user);
}

async function loginWithCredentials(username, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.loginFailed")));
  }

  setSession(data.user);
  await loadGameList();
  render();
}

function render() {
  const renderedGames = visibleGames();
  const selected = selectedGame();
  const selectedId = state.selectedGameId || state.currentGameId;
  const hasGames = state.gameList.length > 0;
  const readyGames = state.gameList.filter((game) => game.phase === "lobby" && game.playerCount >= 2).length;
  const activeGame = state.gameList.find((game) => game.id === state.currentGameId) || null;

  elements.gameListState.className = "session-feedback" + (state.gameListState === "error" ? " is-error" : "") + (hasGames ? " is-hidden" : "");
  if (state.gameListState === "loading") {
    elements.gameListState.textContent = t("lobby.loading");
  } else if (state.gameListState === "error") {
    elements.gameListState.textContent = state.gameListError || t("lobby.errors.loadGames");
  } else {
    elements.gameListState.textContent = t("lobby.empty");
  }

  elements.gameSessionList.innerHTML = renderedGames
    .map((game) => 
      '<button type="button" class="session-row session-row-button' + (game.id === selectedId ? ' is-selected' : '') + '" data-game-id="' + game.id + '">' +
        '<span class="session-primary" data-cell-label="' + t("lobby.table.game") + '">' +
          '<span class="session-name" data-open-game-id="' + game.id + '" role="link" tabindex="0">' + escapeHtml(game.name) + '</span>' +
        '</span>' +
        '<span class="session-cell-muted" data-cell-label="' + t("lobby.table.map") + '">' + escapeHtml(game.mapName || game.mapId || t("common.classicMini")) + '</span>' +
        '<span class="badge' + (game.id === state.currentGameId ? ' accent' : '') + '" data-cell-label="' + t("lobby.table.status") + '">' + phaseLabel(game.phase) + '</span>' +
        '<span class="session-cell-muted" data-cell-label="' + t("lobby.table.players") + '">' + gameCapacityLabel(game) + '</span>' +
        '<span class="session-cell-muted" data-cell-label="' + t("lobby.table.updated") + '">' + formatUpdatedTime(game.updatedAt) + '</span>' +
      '</button>'
    )
    .join("");

  elements.authStatus.textContent = state.user
    ? t("lobby.auth.loggedIn", { username: state.user.username })
    : t("lobby.auth.loggedOut");
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

  elements.selectedGameStatus.textContent = selected ? phaseLabel(selected.phase) : t("lobby.details.emptyBadge");
  elements.gameStatus.textContent = state.currentGameId
    ? t("lobby.status.activeGame", { name: (((state.gameList.find((game) => game.id === state.currentGameId) || {}).name) || state.currentGameId) })
    : t("lobby.gameStatus");
  elements.lobbyTotalGames.textContent = String(renderedGames.length);
  elements.lobbyReadyGames.textContent = String(readyGames);
  elements.lobbyActiveFocus.textContent = activeGame ? activeGame.name : t("lobby.focus.value");
  elements.lobbyFocusNote.textContent = activeGame
    ? t("lobby.focus.activeNote", { phase: phaseLabel(activeGame.phase) })
    : (state.user
      ? t("lobby.focus.selectNote")
      : t("lobby.focus.loginNote"));

  elements.gameListLoadMoreState.className = "session-list-load-more" + (hasGames ? "" : " is-hidden");
  if (!hasGames) {
    elements.gameListLoadMoreState.textContent = "";
  } else if (canLoadMoreGames()) {
    elements.gameListLoadMoreState.textContent = t("lobby.loadMore.partial", { visible: renderedGames.length, total: state.gameList.length });
  } else {
    elements.gameListLoadMoreState.textContent = t("lobby.loadMore.complete", { total: state.gameList.length });
  }

  elements.gameSessionDetails.innerHTML = selected
    ? '<div class="session-detail-hero">' +
        '<p class="session-detail-kicker">' + t("lobby.details.selectedKicker") + '</p>' +
        '<h4 class="session-detail-title">' + escapeHtml(selected.name) + '</h4>' +
        '<p class="session-detail-copy">' + t("lobby.details.summary", { readiness: readinessLabel(selected), phase: phaseLabel(selected.phase) }) + '</p>' +
      '</div>' +
      '<div class="session-detail-grid">' +
        '<div class="session-detail-item"><span>' + t("lobby.details.name") + '</span><strong>' + escapeHtml(selected.name) + '</strong></div>' +
        '<div class="session-detail-item"><span>' + t("lobby.details.id") + '</span><strong>' + selected.id + '</strong></div>' +
        '<div class="session-detail-item"><span>' + t("lobby.details.status") + '</span><strong>' + phaseLabel(selected.phase) + '</strong></div>' +
        '<div class="session-detail-item"><span>' + t("lobby.details.playersPresent") + '</span><strong>' + gameCapacityLabel(selected) + '</strong></div>' +
        '<div class="session-detail-item"><span>' + t("lobby.details.playersConfigured") + '</span><strong>' + (selected.totalPlayers || t("common.notAvailable")) + '</strong></div>' +
        '<div class="session-detail-item"><span>' + t("lobby.details.map") + '</span><strong>' + escapeHtml(selected.mapName || selected.mapId || t("common.classicMini")) + '</strong></div>' +
        '<div class="session-detail-item"><span>' + t("lobby.details.ai") + '</span><strong>' + (selected.aiCount || 0) + '</strong></div>' +
        '<div class="session-detail-item"><span>' + t("lobby.details.updated") + '</span><strong>' + formatUpdatedTime(selected.updatedAt) + '</strong></div>' +
        '<div class="session-detail-item"><span>' + t("lobby.details.focus") + '</span><strong>' + sessionFocusLabel(selected) + '</strong></div>' +
      '</div>' +
      '<div class="session-detail-note">' + t("lobby.details.note") + '</div>' +
      '<div class="session-detail-actions">' +
        '<button type="button" id="open-selected-inline">' + t("lobby.details.open") + '</button>' +
        (canJoinGame(selected) ? '<button type="button" id="join-selected-inline" class="ghost-button">' + t("lobby.details.joinOpen") + '</button>' : '') +
      '</div>'
    : '<div class="session-empty-copy">' + t("lobby.details.emptyExtended") + '</div>';

  elements.openGameButton.disabled = !selected;
}

function resetVisibleGameCount() {
  state.visibleGameCount = Math.min(state.gameList.length, VISIBLE_GAMES_BATCH_SIZE);
}

function loadMoreGames() {
  if (!canLoadMoreGames()) {
    return false;
  }

  state.visibleGameCount = Math.min(state.gameList.length, state.visibleGameCount + VISIBLE_GAMES_BATCH_SIZE);
  render();
  setupInfiniteScroll();
  return true;
}

function setupInfiniteScroll() {
  if (!elements.gameListLoadMoreState) {
    return;
  }

  if (gameListObserver) {
    gameListObserver.disconnect();
    gameListObserver = null;
  }

  if (!canLoadMoreGames() || typeof IntersectionObserver !== "function") {
    return;
  }

  gameListObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry || !entry.isIntersecting) {
      return;
    }

    loadMoreGames();
  }, {
    root: null,
    rootMargin: "0px 0px 240px 0px",
    threshold: 0.1
  });

  gameListObserver.observe(elements.gameListLoadMoreState);
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
    const error = new Error(translateServerMessage(data, t("errors.requestFailed")));
    error.code = data.code || null;
    throw error;
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
      throw new Error(translateServerMessage(data, t("lobby.errors.loadGames")));
    }

    state.gameList = data.games || [];
    resetVisibleGameCount();
    state.currentGameId = data.activeGameId || null;
    if (!state.selectedGameId || !state.gameList.some((game) => game.id === state.selectedGameId)) {
      updateGameSelection(state.currentGameId || state.gameList[0]?.id || null);
    }
    state.gameListState = state.gameList.length ? "ready" : "empty";
  } catch (error) {
    state.gameList = [];
    resetVisibleGameCount();
    state.gameListState = "error";
    state.gameListError = error.message || t("lobby.errors.loadGames");
  }

  if (renderOnChange) {
    render();
    setupInfiniteScroll();
  }
}

function navigateToGameRoute(gameId) {
  window.location.href = "/game/" + encodeURIComponent(gameId);
}

async function openGameById(gameId) {
  const data = await send("/api/games/open", { gameId });
  state.gameList = data.games || [];
  resetVisibleGameCount();
  state.currentGameId = data.activeGameId || null;
  state.currentGameName = data.game?.name || null;
  updateGameSelection(state.currentGameId);
  state.gameListState = state.gameList.length ? "ready" : "empty";
  render();
  setupInfiniteScroll();
  navigateToGameRoute(gameId);
}

async function handleOpenSelectedGame() {
  const selected = selectedGame();
  if (!selected) {
    return;
  }

  try {
    await openGameById(selected.id);
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
      throw new Error(t("auth.sessionExpired"));
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
setupInfiniteScroll();

if (elements.headerLoginForm) {
  elements.headerLoginForm.dataset.headerLoginManaged = "true";
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
