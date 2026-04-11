import { formatDate, t, translateGameLogEntries, translateMessagePayload, translateServerMessage } from "./i18n.mjs";

const state = {
  playerId: localStorage.getItem("frontline-player-id") || null,
  snapshot: null,
  user: null,
  currentGameId: null,
  currentGameName: null,
  selectedGameId: null,
  gameList: [],
  gameListState: "loading",
  gameListError: "",
  selectedTradeCardIds: [],
  selectedReinforceTerritoryId: null,
  selectedAttackFromId: null,
  selectedAttackToId: null,
  selectedAttackDiceCount: "3",
  attackBanzaiInFlight: false,
  selectedFortifyFromId: null,
  selectedFortifyToId: null,
  tradeError: "",
  tradeSuccess: ""
};

let pendingRequestedGameId = null;
let eventsConnection = null;
let eventsGameId = null;
let eventsMode = null;
let snapshotPollTimer = null;
let snapshotPollInFlight = false;
let privateStateRefreshInFlight = false;
let renderedMapSignature = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requestedGameIdFromRoute() {
  const pathnameMatch = window.location.pathname.match(/^\/game\/([^/]+)$/);
  if (pathnameMatch) {
    return decodeURIComponent(pathnameMatch[1]);
  }

  return new URLSearchParams(window.location.search).get("gameId");
}

function syncGameRoute(gameId) {
  if (pendingRequestedGameId && gameId !== pendingRequestedGameId) {
    return;
  }

  const url = new URL(window.location.href);
  if (gameId) {
    window.history.replaceState({}, "", "/game/" + encodeURIComponent(gameId));
    return;
  }

  if (url.pathname !== "/game.html") {
    window.history.replaceState({}, "", "/game.html");
    return;
  }

  url.searchParams.delete("gameId");
  window.history.replaceState({}, "", url.pathname + url.search);
}

const classicMapLayout = {
  aurora: { x: 17.1, y: 18 },
  bastion: { x: 40.8, y: 14 },
  cinder: { x: 27.6, y: 39 },
  delta: { x: 14.5, y: 63 },
  ember: { x: 50.7, y: 43 },
  forge: { x: 70.4, y: 25 },
  grove: { x: 34.2, y: 84 },
  harbor: { x: 61.8, y: 67 },
  ion: { x: 86.2, y: 50 }
};

const elements = {
  authForm: document.querySelector("#auth-form"),
  authUsername: document.querySelector("#auth-username"),
  authPassword: document.querySelector("#auth-password"),
  headerLoginForm: document.querySelector("#header-login-form"),
  headerAuthUsername: document.querySelector("#header-auth-username"),
  headerAuthPassword: document.querySelector("#header-auth-password"),
  headerLoginButton: document.querySelector("#header-login-button"),
  authStatus: document.querySelector("#auth-status"),
  registerLink: document.querySelector("#register-link"),
  loginButton: document.querySelector("#login-button"),
  logoutButton: document.querySelector("#logout-button"),
  identityStatus: document.querySelector("#identity-status"),
  joinButton: document.querySelector("#join-button"),
  startButton: document.querySelector("#start-button"),
  lobbyControlsSection: document.querySelector("#lobby-controls-section"),
  lobbyActionButtons: document.querySelector("#lobby-action-buttons"),
  gameName: document.querySelector("#game-name"),
  createGameButton: document.querySelector("#create-game-button"),
  gameList: document.querySelector("#game-list"),
  openGameButton: document.querySelector("#open-game-button"),
  createGameButtonSecondary: document.querySelector("#create-game-button-secondary"),
  openGameButtonSecondary: document.querySelector("#open-game-button-secondary"),
  gameStatus: document.querySelector("#game-status"),
  gameMapMeta: document.querySelector("#game-map-meta"),
  gameSetupMeta: document.querySelector("#game-setup-meta"),
  phaseBannerValue: document.querySelector("#phase-banner-value"),
  reinforcementBanner: document.querySelector("#reinforcement-banner"),
  reinforcementBannerValue: document.querySelector("#reinforcement-banner-value"),
  gameListState: document.querySelector("#game-list-state"),
  gameSessionList: document.querySelector("#game-session-list"),
  gameSessionDetails: document.querySelector("#game-session-details"),
  selectedGameStatus: document.querySelector("#selected-game-status"),
  turnBadge: document.querySelector("#turn-badge"),
  statusSummary: document.querySelector("#status-summary"),
  tradeAlert: document.querySelector("#trade-alert"),
  tradeAlertText: document.querySelector("#trade-alert-text"),
  players: document.querySelector("#players"),
  map: document.querySelector("#map"),
  reinforceGroup: document.querySelector("#reinforce-group"),
  reinforceSelect: document.querySelector("#reinforce-select"),
  reinforceAmount: document.querySelector("#reinforce-amount"),
  reinforceMultiButton: document.querySelector("#reinforce-multi-button"),
  attackGroup: document.querySelector("#attack-group"),
  attackFrom: document.querySelector("#attack-from"),
  attackTo: document.querySelector("#attack-to"),
  attackDice: document.querySelector("#attack-dice"),
  attackButton: document.querySelector("#attack-button"),
  attackBanzaiButton: document.querySelector("#attack-banzai-button"),
  conquestGroup: document.querySelector("#conquest-group"),
  conquestArmies: document.querySelector("#conquest-armies"),
  conquestButton: document.querySelector("#conquest-button"),
  fortifyGroup: document.querySelector("#fortify-group"),
  fortifyFrom: document.querySelector("#fortify-from"),
  fortifyTo: document.querySelector("#fortify-to"),
  fortifyArmies: document.querySelector("#fortify-armies"),
  fortifyButton: document.querySelector("#fortify-button"),
  cardTradeGroup: document.querySelector("#card-trade-group"),
  cardTradeAlert: document.querySelector("#card-trade-alert"),
  cardTradeList: document.querySelector("#card-trade-list"),
  cardTradeSummary: document.querySelector("#card-trade-summary"),
  cardTradeBonus: document.querySelector("#card-trade-bonus"),
  cardTradeHelp: document.querySelector("#card-trade-help"),
  cardTradeSuccess: document.querySelector("#card-trade-success"),
  cardTradeError: document.querySelector("#card-trade-error"),
  cardTradeButton: document.querySelector("#card-trade-button"),
  combatResultGroup: document.querySelector("#combat-result-group"),
  combatResultBadge: document.querySelector("#combat-result-badge"),
  combatResultSummary: document.querySelector("#combat-result-summary"),
  combatAttackerRolls: document.querySelector("#combat-attacker-rolls"),
  combatDefenderRolls: document.querySelector("#combat-defender-rolls"),
  combatComparisons: document.querySelector("#combat-comparisons"),
  actionHint: document.querySelector("#action-hint"),
  endTurnButton: document.querySelector("#end-turn-button"),
  surrenderButton: document.querySelector("#surrender-button"),
  log: document.querySelector("#log")
};

function renderNavAvatar(username) {
  const avatar = document.querySelector("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

let pendingMapFitFrame = null;

function fitMapBoardToViewport() {
  const mapStage = document.querySelector(".game-map-stage");
  const mapContainer = document.querySelector(".game-map-stage .map");
  const mapBoard = document.querySelector(".game-map-stage .map-board");
  if (!mapStage || !mapContainer || !mapBoard) {
    return;
  }

  const stageStyles = window.getComputedStyle(mapStage);
  const stagePaddingX =
    Number.parseFloat(stageStyles.paddingLeft || "0") + Number.parseFloat(stageStyles.paddingRight || "0");
  const stagePaddingY =
    Number.parseFloat(stageStyles.paddingTop || "0") + Number.parseFloat(stageStyles.paddingBottom || "0");
  const availableWidth = Math.max(0, mapStage.clientWidth - stagePaddingX);
  const stageRect = mapStage.getBoundingClientRect();
  const availableHeight = Math.max(0, window.innerHeight - stageRect.top - Number.parseFloat(stageStyles.paddingBottom || "0"));
  if (!availableWidth || !availableHeight) {
    return;
  }

  const aspectRatioValue = mapBoard.style.aspectRatio || window.getComputedStyle(mapBoard).aspectRatio || "760 / 500";
  const aspectRatioMatch = aspectRatioValue.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  const aspectRatio = aspectRatioMatch
    ? Number.parseFloat(aspectRatioMatch[1]) / Number.parseFloat(aspectRatioMatch[2])
    : 760 / 500;
  const widthFromHeight = Math.max(0, (availableHeight - stagePaddingY) * aspectRatio);
  const width = Math.min(availableWidth, widthFromHeight);
  const height = width / aspectRatio;

  mapBoard.style.width = `${Math.floor(width)}px`;
  mapBoard.style.height = `${Math.floor(height)}px`;
  mapContainer.style.height = `${Math.ceil(height)}px`;
}

function queueMapBoardFit() {
  if (pendingMapFitFrame != null) {
    window.cancelAnimationFrame(pendingMapFitFrame);
  }

  pendingMapFitFrame = window.requestAnimationFrame(() => {
    pendingMapFitFrame = window.requestAnimationFrame(() => {
      pendingMapFitFrame = null;
      fitMapBoardToViewport();
    });
  });
}

function territoryPosition(territory) {
  if (territory && Number.isFinite(territory.x) && Number.isFinite(territory.y)) {
    return { x: territory.x * 100, y: territory.y * 100 };
  }

  return territory ? classicMapLayout[territory.id] || null : null;
}

function ownerById(ownerId) {
  return state.snapshot?.players.find((player) => player.id === ownerId) || null;
}

function textColorForBackground(color) {
  if (!color || !/^#?[0-9a-f]{6}$/i.test(color)) {
    return "#2c1f14";
  }

  const normalized = color.startsWith("#") ? color.slice(1) : color;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance >= 150 ? "#2c1f14" : "#fffaf0";
}

function territoryById(territoryId) {
  return state.snapshot?.map.find((territory) => territory.id === territoryId) || null;
}

function resolveCurrentPlayer() {
  if (!state.snapshot?.players?.length) {
    return null;
  }

  if (state.playerId) {
    const byId = state.snapshot.players.find((player) => player.id === state.playerId) || null;
    if (byId) {
      return byId;
    }
  }

  if (state.user?.username) {
    return state.snapshot.players.find((player) => player.name === state.user.username) || null;
  }

  return null;
}

function isCurrentPlayer() {
  return state.snapshot?.currentPlayerId === resolveCurrentPlayer()?.id;
}

function myTerritories() {
  const currentPlayer = resolveCurrentPlayer();
  return (state.snapshot?.map || []).filter((territory) => territory.ownerId === currentPlayer?.id);
}

function currentExpectedVersion() {
  return Number.isInteger(state.snapshot?.version) ? state.snapshot.version : undefined;
}

function currentGamePayload() {
  return state.currentGameId ? { gameId: state.currentGameId } : {};
}

function currentPlayerHand() {
  return Array.isArray(state.snapshot?.playerHand) ? state.snapshot.playerHand : [];
}

function ensurePrivateStateFresh(currentPlayer) {
  if (!state.user || !currentPlayer || privateStateRefreshInFlight) {
    return;
  }

  const expectedCardCount = Number.isInteger(currentPlayer.cardCount) ? currentPlayer.cardCount : null;
  if (expectedCardCount == null || currentPlayerHand().length >= expectedCardCount) {
    return;
  }

  privateStateRefreshInFlight = true;
  setTimeout(async () => {
    try {
      await loadState();
    } catch (error) {
    } finally {
      privateStateRefreshInFlight = false;
    }
  }, 0);
}

async function refreshPrivateStateIfNeeded(nextState) {
  if (!state.user || !nextState?.players?.length) {
    return nextState;
  }

  const currentPlayerId = state.playerId || resolveCurrentPlayer()?.id || null;
  const currentPlayer = nextState.players.find((player) => player.id === currentPlayerId) || null;
  const hand = Array.isArray(nextState.playerHand) ? nextState.playerHand : [];
  if (!currentPlayer || !Number.isInteger(currentPlayer.cardCount) || hand.length >= currentPlayer.cardCount) {
    return nextState;
  }

  let latestState = nextState;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      latestState = await fetchLatestStateSnapshot({ includeGameId: false });
      const latestHand = Array.isArray(latestState.playerHand) ? latestState.playerHand : [];
      if (latestHand.length >= currentPlayer.cardCount) {
        return latestState;
      }
    } catch (error) {
      return latestState;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return latestState;
}

function currentDiceRuleSet() {
  return state.snapshot?.diceRuleSet || { attackerMaxDice: 3, defenderMaxDice: 2 };
}

function selectOrFallback(selectedId, options, fallbackId = "") {
  if (selectedId && options.some((option) => option.id === selectedId)) {
    return selectedId;
  }

  return fallbackId || options[0]?.id || "";
}

function attackDiceOptions(maxDice) {
  if (maxDice < 1) {
    return '<option value="">' + t("game.runtime.noDiceAvailable") + '</option>';
  }

  return Array.from({ length: maxDice }, (_, index) => {
    const value = String(index + 1);
    return '<option value="' + value + '">' + t("game.runtime.attackDiceOption", { count: value, suffix: value === "1" ? "" : "i" }) + '</option>';
  }).join("");
}

function cardTypeLabel(type) {
  const labels = {
    infantry: t("game.runtime.cardType.infantry"),
    cavalry: t("game.runtime.cardType.cavalry"),
    artillery: t("game.runtime.cardType.artillery"),
    wild: t("game.runtime.cardType.wild")
  };
  return labels[type] || String(type || t("game.runtime.cardType.default"));
}

function cardDisplayLabel(card) {
  const territoryName = card.territoryId ? (territoryById(card.territoryId)?.name || card.territoryId) : null;
  return territoryName ? `${cardTypeLabel(card.type)} · ${territoryName}` : cardTypeLabel(card.type);
}

function formatDiceList(rolls) {
  return Array.isArray(rolls) && rolls.length ? rolls.join(" · ") : "-";
}

function formatCombatComparisons(comparisons) {
  if (!Array.isArray(comparisons) || !comparisons.length) {
    return "-";
  }

  return comparisons.map((comparison) => comparison.winner === "attacker" ? "A" : "D").join(" · ");
}

function setSession(user) {
  state.user = user;
}

function clearPlayerIdentity() {
  state.playerId = null;
  localStorage.removeItem("frontline-player-id");
}

function setPlayerIdentity(playerId) {
  state.playerId = playerId;
  localStorage.setItem("frontline-player-id", playerId);
}

function territoryOptionLabel(territory) {
  return `${territory.name} (${territory.armies})`;
}

function selectedAttackContext() {
  const fromId = elements.attackFrom?.value || "";
  const toId = elements.attackTo?.value || "";
  const from = territoryById(fromId);
  const to = territoryById(toId);
  return { fromId, toId, from, to };
}

function normalizedAttackDiceValue() {
  const { from } = selectedAttackContext();
  if (!from) {
    return null;
  }

  const diceRuleSet = currentDiceRuleSet();
  const maxAttackDice = Math.max(0, Math.min(diceRuleSet.attackerMaxDice || 3, from.armies - 1));
  if (maxAttackDice < 1) {
    return null;
  }

  const selectedDice = Number.parseInt(elements.attackDice?.value || "", 10);
  if (!Number.isInteger(selectedDice) || selectedDice < 1) {
    return maxAttackDice;
  }

  return Math.min(selectedDice, maxAttackDice);
}

function normalizedReinforcementAmount() {
  const rawValue = Number.parseInt(elements.reinforceAmount?.value || "1", 10);
  const maxAllowed = Math.max(1, Number(state.snapshot?.reinforcementPool || 1));
  const normalized = Number.isFinite(rawValue) ? rawValue : 1;
  return Math.max(1, Math.min(normalized, maxAllowed));
}

async function applyReinforcements(times) {
  const total = Math.max(1, Math.floor(Number(times) || 1));
  const data = await send("/api/action", {
    ...currentGamePayload(),
    playerId: state.playerId,
    type: "reinforce",
    territoryId: elements.reinforceSelect.value,
    amount: total,
    expectedVersion: currentExpectedVersion()
  });
  state.snapshot = data.state;
  render();
}

async function executeAttack(fromId, toId, attackDice) {
  const data = await send("/api/action", {
    ...currentGamePayload(),
    playerId: state.playerId,
    type: "attack",
    fromId,
    toId,
    attackDice,
    expectedVersion: currentExpectedVersion()
  });
  state.snapshot = data.state;
  if (!state.snapshot.pendingConquest && elements.conquestArmies) {
    elements.conquestArmies.value = "";
  }
  render();
  return data.state;
}

async function runBanzaiAttack() {
  const initialContext = selectedAttackContext();
  if (!initialContext.fromId || !initialContext.toId) {
    return;
  }

  state.attackBanzaiInFlight = true;
  render();

  try {
    const attackDice = normalizedAttackDiceValue();
    if (!attackDice) {
      return;
    }

    const data = await send("/api/action", {
      ...currentGamePayload(),
      playerId: state.playerId,
      type: "attackBanzai",
      fromId: initialContext.fromId,
      toId: initialContext.toId,
      attackDice,
      expectedVersion: currentExpectedVersion()
    });
    state.snapshot = data.state;
    if (!state.snapshot.pendingConquest && elements.conquestArmies) {
      elements.conquestArmies.value = "";
    }
    render();
  } finally {
    state.attackBanzaiInFlight = false;
    render();
  }
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

function selectedGame() {
  const selectedId = state.selectedGameId || state.currentGameId;
  return state.gameList.find((game) => game.id === selectedId) || null;
}

function updateGameSelection(gameId) {
  state.selectedGameId = gameId || null;
  if (elements.gameList) {
    elements.gameList.value = state.selectedGameId || "";
  }
}

function syncCurrentGameName() {
  state.currentGameName = state.snapshot?.gameName || (state.gameList.find((game) => game.id === state.currentGameId) || {}).name || state.currentGameName || null;
}

function renderGameSessionBrowser() {
  const selected = selectedGame();
  const selectedId = state.selectedGameId || state.currentGameId;
  const hasGames = state.gameList.length > 0;

  if (!elements.gameList) {
    return;
  }

  elements.gameList.innerHTML = state.gameList
    .map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name)}</option>`)
    .join("") || '<option value="">' + t("game.runtime.noGamesOption") + '</option>';

  if (selectedId && state.gameList.some((game) => game.id === selectedId)) {
    elements.gameList.value = selectedId;
  }

  if (!elements.gameListState || !elements.gameSessionList || !elements.gameSessionDetails || !elements.selectedGameStatus) {
    elements.openGameButton.disabled = !selected;
    return;
  }

  elements.gameListState.className = `session-feedback${state.gameListState === "error" ? " is-error" : ""}${hasGames ? " is-hidden" : ""}`;
  if (state.gameListState === "loading") {
    elements.gameListState.textContent = t("lobby.loading");
  } else if (state.gameListState === "error") {
    elements.gameListState.textContent = state.gameListError || t("lobby.errors.loadGames");
  } else {
    elements.gameListState.textContent = t("lobby.empty");
  }

  elements.gameSessionList.innerHTML = state.gameList
    .map((game) => `
      <button type="button" class="session-row session-row-button${game.id === selectedId ? " is-selected" : ""}" data-game-id="${game.id}">
        <span class="session-primary">
          <span class="session-name">${escapeHtml(game.name)}</span>
          <span class="session-sub">${t("game.runtime.sessionShort", { id: game.id.slice(0, 8) })}</span>
        </span>
        <span class="session-cell-muted">${game.id}</span>
        <span class="badge${game.id === state.currentGameId ? " accent" : ""}">${phaseLabel(game.phase)}</span>
        <span class="session-cell-muted">${game.playerCount}/4</span>
        <span class="session-cell-muted">${formatUpdatedTime(game.updatedAt)}</span>
      </button>
    `)
    .join("");

  elements.selectedGameStatus.textContent = selected ? phaseLabel(selected.phase) : t("lobby.details.emptyBadge");
  elements.gameSessionDetails.innerHTML = selected
    ? `
      <div class="session-detail-grid">
        <div class="session-detail-item"><span>${t("lobby.details.name")}</span><strong>${escapeHtml(selected.name)}</strong></div>
        <div class="session-detail-item"><span>${t("lobby.details.id")}</span><strong>${selected.id}</strong></div>
        <div class="session-detail-item"><span>${t("lobby.details.status")}</span><strong>${phaseLabel(selected.phase)}</strong></div>
        <div class="session-detail-item"><span>${t("lobby.details.playersPresent")}</span><strong>${selected.playerCount}/4</strong></div>
        <div class="session-detail-item"><span>${t("lobby.details.updated")}</span><strong>${formatUpdatedTime(selected.updatedAt)}</strong></div>
        <div class="session-detail-item"><span>${t("lobby.details.focus")}</span><strong>${selected.id === state.currentGameId ? t("lobby.focus.openSession") : t("lobby.focus.available")}</strong></div>
      </div>
      <div class="session-detail-actions">
        <button type="button" id="open-selected-inline">${t("game.runtime.openGame")}</button>
      </div>
    `
    : '<div class="session-empty-copy">' + t("game.runtime.selectGameFromList") + '</div>';

  const hasSelection = Boolean(selected);
  if (elements.openGameButton) {
    elements.openGameButton.disabled = !hasSelection;
  }
  if (elements.openGameButtonSecondary) {
    elements.openGameButtonSecondary.disabled = !hasSelection;
  }
}

function buildGraphMarkup(snapshot) {
  const renderedLinks = new Set();
  const links = [];

  snapshot.map.forEach((territory) => {
    territory.neighbors.forEach((neighborId) => {
      const key = [territory.id, neighborId].sort().join(":");
      if (renderedLinks.has(key)) {
        return;
      }

      renderedLinks.add(key);
      const source = territoryPosition(territory);
      const target = territoryPosition(snapshot.map.find((entry) => entry.id === neighborId) || { id: neighborId });
      if (!source || !target) {
        return;
      }

      links.push(`
        <line x1="${source.x}%" y1="${source.y}%" x2="${target.x}%" y2="${target.y}%" class="map-link" />
      `);
    });
  });

  const nodes = snapshot.map
    .map((territory) => {
      const owner = ownerById(territory.ownerId);
      const position = territoryPosition(territory);
      if (!position) {
        return "";
      }
      const classes = [
        "territory-node",
        territory.ownerId === state.playerId ? "is-mine" : "",
        state.selectedAttackFromId === territory.id ? "is-source" : "",
        state.selectedAttackToId === territory.id ? "is-target" : "",
        state.selectedReinforceTerritoryId === territory.id ? "is-reinforce" : ""
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <button
          type="button"
          class="${classes}"
          data-territory-id="${territory.id}"
          title="${escapeHtml(territory.name)}"
          aria-label="${escapeHtml(`${territory.name}: ${territory.armies} armate`)}"
          style="left:${position.x}%; top:${position.y}%; --owner-color:${owner?.color || "#9aa6b2"}; --owner-text-color:${textColorForBackground(owner?.color || "#9aa6b2")};"
        >
          <span class="territory-armies">${territory.armies}</span>
          <span class="visually-hidden">${escapeHtml(owner?.name || "neutrale")}</span>
        </button>
      `;
    })
    .join("");

  const details = snapshot.map
    .map((territory) => {
      const owner = ownerById(territory.ownerId);
      return `
        <article class="territory-card">
          <strong>${escapeHtml(territory.name)}</strong>
          <div>Controllo: ${escapeHtml(owner ? owner.name : "neutrale")}</div>
          <div>Armate: ${territory.armies}</div>
          <div>Confini: ${escapeHtml(territory.neighbors.join(", "))}</div>
        </article>
      `;
    })
    .join("");

  const boardStyles = [];
  const boardClasses = ["map-board"];
  if (snapshot.mapId) {
    boardClasses.push(`map-id-${String(snapshot.mapId).replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}`);
  }
  if (snapshot.mapVisual?.imageUrl) {
    boardClasses.push("has-custom-background");
    boardStyles.push(`--map-background-image:url('${snapshot.mapVisual.imageUrl}')`);
  }
  if (snapshot.mapVisual?.aspectRatio?.width && snapshot.mapVisual?.aspectRatio?.height) {
    boardStyles.push(`aspect-ratio:${snapshot.mapVisual.aspectRatio.width} / ${snapshot.mapVisual.aspectRatio.height}`);
  }

  return `
    <div class="${boardClasses.join(" ")}"${boardStyles.length ? ` style="${boardStyles.join("; ")}"` : ""}>
      <div class="map-board-stage">
        <svg class="map-lines" viewBox="0 0 100 100" aria-hidden="true">${links.join("")}</svg>
        ${nodes}
      </div>
    </div>
    <div class="map-legend">${details}</div>
  `;
}

function currentRenderedMapSignature(snapshot) {
  if (!snapshot) {
    return "empty";
  }

  return [
    snapshot.gameId || "",
    Number.isInteger(snapshot.version) ? snapshot.version : "",
    state.playerId || "",
    snapshot.mapId || "",
    snapshot.mapVisual?.imageUrl || "",
    snapshot.mapVisual?.aspectRatio?.width || "",
    snapshot.mapVisual?.aspectRatio?.height || "",
    snapshot.map.map((territory) => `${territory.id}:${territory.ownerId || ""}:${territory.armies}`).join(",")
  ].join("|");
}

function updateMapTerritoryHighlights() {
  if (!elements.map) {
    return;
  }

  const selectedAttackFromId = state.selectedAttackFromId;
  const selectedAttackToId = state.selectedAttackToId;
  const selectedReinforceTerritoryId = state.selectedReinforceTerritoryId;

  elements.map.querySelectorAll("[data-territory-id]").forEach((node) => {
    const territoryId = node.getAttribute("data-territory-id");
    const territory = territoryById(territoryId);
    node.classList.toggle("is-mine", territory?.ownerId === state.playerId);
    node.classList.toggle("is-source", territoryId === selectedAttackFromId);
    node.classList.toggle("is-target", territoryId === selectedAttackToId);
    node.classList.toggle("is-reinforce", territoryId === selectedReinforceTerritoryId);
  });
}

function handleTerritoryClick(territoryId) {
  const territory = territoryById(territoryId);
  if (!territory) {
    return;
  }

  if (territory.ownerId === state.playerId) {
    state.selectedReinforceTerritoryId = territory.id;
    state.selectedAttackFromId = territory.id;
    state.selectedAttackDiceCount = "";
    state.selectedFortifyFromId = territory.id;
  } else if (territory.ownerId) {
    const source = territoryById(state.selectedAttackFromId) || myTerritories()[0];
    if (source?.neighbors.includes(territory.id)) {
      state.selectedAttackToId = territory.id;
    }
  }

  render();
}

function render() {
  const snapshot = state.snapshot;
  if (snapshot?.gameId) {
    state.currentGameId = snapshot.gameId;
  }
  const me = resolveCurrentPlayer();
  if (me && me.id !== state.playerId) {
    setPlayerIdentity(me.id);
  }
  const currentPlayer = snapshot?.players.find((player) => player.id === snapshot.currentPlayerId) || null;
  ensurePrivateStateFresh(me);
  const winner = snapshot?.players.find((player) => player.id === snapshot.winnerId) || null;
  const inLobby = snapshot?.phase === "lobby";
  const playerHand = currentPlayerHand();
  state.selectedTradeCardIds = state.selectedTradeCardIds.filter((cardId) => playerHand.some((card) => card.id === cardId));
  if (!playerHand.length) {
    state.tradeError = "";
    state.tradeSuccess = "";
  }

  elements.authStatus.textContent = state.user
    ? t("game.runtime.loggedIn", { username: state.user.username })
    : t("game.runtime.accessRequired");
  renderNavAvatar(state.user?.username);

  renderGameSessionBrowser();

  syncCurrentGameName();
  elements.gameStatus.textContent = state.currentGameId
    ? (state.currentGameName || state.currentGameId)
    : t("game.runtime.none");
  elements.gameMapMeta.textContent = snapshot?.gameConfig?.mapName || snapshot?.gameConfig?.mapId || t("common.classicMini");
  const totalPlayers = snapshot?.gameConfig?.totalPlayers || 2;
  const aiCount = Array.isArray(snapshot?.gameConfig?.players)
    ? snapshot.gameConfig.players.filter((player) => player.type === "ai").length
    : 0;
  const playerLabel = totalPlayers === 1 ? t("game.runtime.playerSingle") : t("game.runtime.playerPlural");
  elements.gameSetupMeta.textContent = t("game.runtime.setupMeta", { totalPlayers, playerLabel, aiCount });
  syncGameRoute(state.currentGameId);

  elements.identityStatus.textContent = state.user
    ? me
      ? me.name
      : t("game.runtime.unassigned")
    : t("game.runtime.notConnected");

  elements.turnBadge.textContent =
    !snapshot
      ? "Lobby"
      : snapshot.phase === "lobby"
      ? "Lobby"
      : snapshot.phase === "finished"
          ? t("game.runtime.finished")
          : currentPlayer
            ? t("game.runtime.turnOf", { name: currentPlayer.name })
            : t("game.runtime.waiting");

  elements.statusSummary.innerHTML = snapshot
    ? `
      <div>Fase: <strong>${escapeHtml(snapshot.phase)}</strong></div>
      <div>${t("game.reinforcementBanner")} <strong>${snapshot.reinforcementPool}</strong></div>
      <div>${t("game.runtime.winner")}: <strong>${escapeHtml(winner ? winner.name : t("game.runtime.noneLower"))}</strong></div>
    `
    : "<div>" + t("game.runtime.loadingState") + "</div>";

  elements.players.innerHTML = (snapshot?.players || [])
    .map(
      (player) => `
        <article class="player-card">
          <strong>${escapeHtml(player.name)}</strong>
          <div>${t("game.runtime.territories")}: ${player.territoryCount}</div>
          <div>${t("lobby.table.status")}: ${player.eliminated ? t("game.runtime.eliminated") : t("game.runtime.active")}</div>
          <div style="margin-top: 8px; height: 10px; border-radius: 99px; background: ${player.color};"></div>
        </article>
      `
    )
    .join("");

  const territories = myTerritories();
  const reinforceOptions = territories
    .map((territory) => `<option value="${territory.id}">${territoryOptionLabel(territory)}</option>`)
    .join("");
  const selectedReinforceId = selectOrFallback(state.selectedReinforceTerritoryId, territories);
  state.selectedReinforceTerritoryId = selectedReinforceId || null;
  elements.reinforceSelect.innerHTML = reinforceOptions || '<option value="">' + t("game.runtime.noTerritory") + '</option>';
  if (selectedReinforceId) {
    elements.reinforceSelect.value = selectedReinforceId;
  }
  if (elements.reinforceAmount) {
    const maxReinforcements = Math.max(1, Number(snapshot?.reinforcementPool || 1));
    elements.reinforceAmount.min = "1";
    elements.reinforceAmount.max = String(maxReinforcements);
    elements.reinforceAmount.value = String(normalizedReinforcementAmount());
  }

  const selectedFromId = selectOrFallback(state.selectedAttackFromId, territories, selectedReinforceId);
  state.selectedAttackFromId = selectedFromId || null;
  elements.attackFrom.innerHTML = reinforceOptions || '<option value="">' + t("game.runtime.noTerritory") + '</option>';
  if (selectedFromId) {
    elements.attackFrom.value = selectedFromId;
  }

  const source = snapshot?.map.find((territory) => territory.id === selectedFromId) || null;
  const attackTargets = (snapshot?.map || []).filter(
    (territory) =>
      source?.neighbors.includes(territory.id) &&
      territory.ownerId &&
      territory.ownerId !== state.playerId
  );
  const selectedAttackToId = selectOrFallback(state.selectedAttackToId, attackTargets);
  state.selectedAttackToId = selectedAttackToId || null;

  elements.attackTo.innerHTML =
    attackTargets
      .map((territory) => {
        const owner = ownerById(territory.ownerId);
        return `<option value="${territory.id}">${escapeHtml(territory.name)} vs ${escapeHtml(owner?.name || "?")} (${territory.armies})</option>`;
      })
      .join("") || '<option value="">' + t("game.runtime.noTarget") + '</option>';

  if (selectedAttackToId) {
    elements.attackTo.value = selectedAttackToId;
  }

  const maxAttackDice = source
    ? Math.max(0, Math.min(currentDiceRuleSet().attackerMaxDice || 3, source.armies - 1))
    : 0;
  elements.attackDice.innerHTML = attackDiceOptions(maxAttackDice);
  if (maxAttackDice > 0) {
    const selectedAttackDiceCount = String(Math.min(Number(state.selectedAttackDiceCount || maxAttackDice), maxAttackDice));
    state.selectedAttackDiceCount = selectedAttackDiceCount;
    elements.attackDice.value = selectedAttackDiceCount;
  } else {
    state.selectedAttackDiceCount = "";
    elements.attackDice.value = "";
  }

  const selectedFortifyFromId = selectOrFallback(state.selectedFortifyFromId, territories, selectedReinforceId);
  state.selectedFortifyFromId = selectedFortifyFromId || null;
  elements.fortifyFrom.innerHTML = reinforceOptions || '<option value="">' + t("game.runtime.noTerritory") + '</option>';
  if (selectedFortifyFromId) {
    elements.fortifyFrom.value = selectedFortifyFromId;
  }

  const fortifySource = territoryById(selectedFortifyFromId);
  const fortifyTargets = territories.filter(
    (territory) => territory.id !== selectedFortifyFromId && fortifySource?.neighbors.includes(territory.id)
  );
  const selectedFortifyToId = selectOrFallback(state.selectedFortifyToId, fortifyTargets);
  state.selectedFortifyToId = selectedFortifyToId || null;

  elements.fortifyTo.innerHTML =
    fortifyTargets
      .map((territory) => `<option value="${territory.id}">${territoryOptionLabel(territory)}</option>`)
      .join("") || '<option value="">' + t("game.runtime.noAdjacentTerritory") + '</option>';

  if (selectedFortifyToId) {
    elements.fortifyTo.value = selectedFortifyToId;
  }

  if (fortifySource && elements.fortifyArmies && !elements.fortifyArmies.value) {
    elements.fortifyArmies.value = "1";
  }

  const nextMapSignature = currentRenderedMapSignature(snapshot);
  if (nextMapSignature !== renderedMapSignature) {
    elements.map.innerHTML = snapshot ? buildGraphMarkup(snapshot) : "";
    renderedMapSignature = nextMapSignature;
    queueMapBoardFit();
  } else {
    updateMapTerritoryHighlights();
  }
  const logEntries = translateGameLogEntries(snapshot);
  elements.log.innerHTML = logEntries.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  const inReinforcement = snapshot?.turnPhase === "reinforcement";
  const inAttack = snapshot?.turnPhase === "attack";
  const inFortify = snapshot?.turnPhase === "fortify";
  const canInteract = Boolean(me) && snapshot?.phase === "active" && isCurrentPlayer();
  const canSurrender = Boolean(me) && snapshot?.phase === "active" && !me.eliminated;
  const pendingConquest = snapshot?.pendingConquest || null;
  const isAuthenticated = Boolean(state.user);
  elements.authForm.classList.toggle("is-authenticated", isAuthenticated);
  elements.authUsername.hidden = isAuthenticated;
  elements.authPassword.hidden = isAuthenticated;
  elements.loginButton.hidden = isAuthenticated;
  elements.loginButton.disabled = isAuthenticated;
  if (elements.registerLink) {
    elements.registerLink.hidden = isAuthenticated;
    elements.registerLink.setAttribute("aria-hidden", isAuthenticated ? "true" : "false");
  }
  if (elements.headerLoginForm) {
    elements.headerLoginForm.hidden = isAuthenticated;
    elements.headerAuthUsername.disabled = isAuthenticated;
    elements.headerAuthPassword.disabled = isAuthenticated;
    elements.headerLoginButton.disabled = isAuthenticated;
  }
  elements.logoutButton.hidden = !isAuthenticated;
  elements.logoutButton.disabled = !isAuthenticated;
  if (elements.phaseBannerValue) {
    elements.phaseBannerValue.textContent = phaseLabel(snapshot?.phase);
  }
  if (elements.lobbyControlsSection) {
    elements.lobbyControlsSection.hidden = !inLobby;
  }
  if (elements.reinforcementBanner) {
    elements.reinforcementBanner.hidden = !canInteract || !inReinforcement;
  }
  if (elements.reinforcementBannerValue) {
    elements.reinforcementBannerValue.textContent = String(snapshot?.reinforcementPool ?? 0);
  }
  if (elements.lobbyActionButtons) {
    elements.lobbyActionButtons.hidden = !inLobby;
  }
  elements.joinButton.hidden = !inLobby;
  elements.startButton.hidden = !inLobby;
  elements.joinButton.disabled = !state.user || Boolean(me) || !inLobby;
  elements.startButton.disabled = !me || !inLobby || snapshot.players.length < 2;
  if (elements.createGameButton) {
    elements.createGameButton.disabled = false;
  }
  if (elements.createGameButtonSecondary) {
    elements.createGameButtonSecondary.disabled = false;
  }
  if (elements.reinforceGroup) {
    elements.reinforceGroup.hidden = !canInteract || !inReinforcement || Boolean(pendingConquest);
  }
  if (elements.attackGroup) {
    elements.attackGroup.hidden = !canInteract || !inAttack || Boolean(pendingConquest);
  }
  if (elements.conquestGroup) {
    elements.conquestGroup.hidden = !canInteract || !pendingConquest;
  }
  if (elements.fortifyGroup) {
    elements.fortifyGroup.hidden = !canInteract || !inFortify || Boolean(pendingConquest) || Boolean(snapshot?.fortifyUsed);
  }
  if (pendingConquest && elements.conquestArmies) {
    elements.conquestArmies.min = String(pendingConquest.minArmies || 1);
    elements.conquestArmies.max = String(pendingConquest.maxArmies || pendingConquest.minArmies || 1);
    if (!elements.conquestArmies.value) {
      elements.conquestArmies.value = String(pendingConquest.minArmies || 1);
    }
  }

  const lastCombat = snapshot?.lastCombat || null;
  if (elements.combatResultGroup) {
    elements.combatResultGroup.hidden = !lastCombat;
    if (lastCombat) {
      const conquestText = lastCombat.conqueredTerritory ? t("game.runtime.combat.conquered") : lastCombat.defenderReducedToZero ? t("game.runtime.combat.defenseBroken") : t("game.runtime.combat.resolved");
      elements.combatResultBadge.textContent = conquestText;
      elements.combatResultSummary.textContent = `${territoryById(lastCombat.fromTerritoryId)?.name || lastCombat.fromTerritoryId} -> ${territoryById(lastCombat.toTerritoryId)?.name || lastCombat.toTerritoryId}`;
      elements.combatAttackerRolls.textContent = formatDiceList(lastCombat.attackerRolls);
      elements.combatDefenderRolls.textContent = formatDiceList(lastCombat.defenderRolls);
      elements.combatComparisons.textContent = formatCombatComparisons(lastCombat.comparisons);
    }
  }
  const mustTradeCards = Boolean(me) && isCurrentPlayer() && Boolean(snapshot?.cardState?.currentPlayerMustTrade);
  const showTradePanel = Boolean(playerHand.length) || mustTradeCards;
  if (elements.tradeAlert) {
    elements.tradeAlert.hidden = !mustTradeCards;
  }
  if (elements.tradeAlertText) {
    elements.tradeAlertText.textContent = mustTradeCards
      ? t("game.runtime.tradeAlert.mustTradeNow", { cardCount: playerHand.length, limit: snapshot?.cardState?.maxHandBeforeForcedTrade || 5 })
      : t("game.tradeAlert.copy");
  }
  if (elements.cardTradeGroup) {
    elements.cardTradeGroup.hidden = !canInteract || !inReinforcement || Boolean(pendingConquest) || !showTradePanel;
    if (elements.cardTradeAlert) {
      elements.cardTradeAlert.hidden = !mustTradeCards;
    }
    elements.cardTradeSummary.textContent = t("game.runtime.cardsInHand", { count: playerHand.length });
    elements.cardTradeBonus.textContent = t("game.runtime.nextTradeBonus", { bonus: snapshot?.cardState?.nextTradeBonus || 4 });
    elements.cardTradeList.innerHTML = playerHand.length
      ? playerHand.map((card) => `<button type="button" class="card-chip${state.selectedTradeCardIds.includes(card.id) ? " is-selected" : ""}" data-card-id="${card.id}" aria-pressed="${state.selectedTradeCardIds.includes(card.id) ? "true" : "false"}"><span>${cardDisplayLabel(card)}</span></button>`).join("")
      : '<p class="card-trade-empty">' + t("game.runtime.noCardsAvailable") + '</p>';
    elements.cardTradeHelp.textContent = mustTradeCards
      ? t("game.runtime.tradeHelp.mustTrade", { limit: snapshot?.cardState?.maxHandBeforeForcedTrade || 5 })
      : playerHand.length
        ? t("game.runtime.tradeHelp.selected", { selected: state.selectedTradeCardIds.length })
        : t("game.runtime.noCardsAvailable");
    elements.cardTradeSuccess.hidden = !state.tradeSuccess;
    elements.cardTradeSuccess.textContent = state.tradeSuccess;
    elements.cardTradeError.hidden = !state.tradeError;
    elements.cardTradeError.textContent = state.tradeError;
    elements.cardTradeButton.disabled = !canInteract || !inReinforcement || Boolean(pendingConquest) || state.selectedTradeCardIds.length !== 3;
  }
  if (elements.reinforceAmount) {
    elements.reinforceAmount.disabled = !canInteract || !inReinforcement || Boolean(pendingConquest) || snapshot.reinforcementPool <= 0 || !elements.reinforceSelect.value;
  }
  if (elements.reinforceMultiButton) {
    elements.reinforceMultiButton.disabled = !canInteract || !inReinforcement || Boolean(pendingConquest) || snapshot.reinforcementPool <= 0 || !elements.reinforceSelect.value;
  }
  elements.attackButton.disabled = !canInteract || !inAttack || Boolean(pendingConquest) || Boolean(state.attackBanzaiInFlight) || snapshot.reinforcementPool > 0 || !elements.attackFrom.value || !elements.attackTo.value || !elements.attackDice.value;
  if (elements.attackBanzaiButton) {
    elements.attackBanzaiButton.disabled = !canInteract || !inAttack || Boolean(pendingConquest) || Boolean(state.attackBanzaiInFlight) || snapshot.reinforcementPool > 0 || !elements.attackFrom.value || !elements.attackTo.value || !elements.attackDice.value;
    elements.attackBanzaiButton.textContent = state.attackBanzaiInFlight ? t("game.runtime.banzaiLoading") : t("game.actions.banzai");
  }
  elements.conquestButton.disabled = !canInteract || !pendingConquest || !elements.conquestArmies.value;
  elements.fortifyButton.disabled = !canInteract || !inFortify || snapshot.fortifyUsed || !elements.fortifyFrom.value || !elements.fortifyTo.value || !elements.fortifyArmies.value;
  elements.endTurnButton.hidden = !canInteract || inReinforcement || Boolean(pendingConquest);
  elements.endTurnButton.disabled = !canInteract || inReinforcement || Boolean(pendingConquest);
  elements.endTurnButton.textContent = inAttack ? t("game.runtime.goToFortify") : t("game.actions.endTurn");
  if (elements.surrenderButton) {
    elements.surrenderButton.hidden = !canSurrender;
    elements.surrenderButton.disabled = !canSurrender;
  }
  if (elements.actionHint) {
    elements.actionHint.textContent = canInteract
      ? pendingConquest
        ? t("game.runtime.conquest")
        : inReinforcement
          ? t("game.runtime.hint.reinforcements")
          : inFortify
            ? snapshot.fortifyUsed
              ? t("game.runtime.hint.closeTurn")
              : t("game.actions.fortify")
            : t("game.runtime.hint.attack")
      : state.user
        ? t("game.runtime.hint.observation")
        : t("game.runtime.hint.login");
  }
}

async function fetchLatestStateSnapshot(options = {}) {
  const includeGameId = options.includeGameId !== false;
  const query = includeGameId && state.currentGameId ? "?gameId=" + encodeURIComponent(state.currentGameId) : "";
  const response = await fetch("/api/state" + query);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("game.errors.loadActiveGame")));
  }
  return data;
}

function shouldAcceptSnapshot(nextSnapshot, options = {}) {
  if (!nextSnapshot || typeof nextSnapshot !== "object") {
    return false;
  }

  const currentSnapshot = state.snapshot;
  if (!currentSnapshot || typeof currentSnapshot !== "object") {
    return true;
  }

  const nextGameId = nextSnapshot.gameId || state.currentGameId || null;
  const currentGameId = currentSnapshot.gameId || state.currentGameId || null;
  if (nextGameId && currentGameId && nextGameId !== currentGameId) {
    return options.allowGameSwitch === true;
  }

  const nextVersion = Number.isInteger(nextSnapshot.version) ? nextSnapshot.version : null;
  const currentVersion = Number.isInteger(currentSnapshot.version) ? currentSnapshot.version : null;
  if (nextVersion != null && currentVersion != null && nextVersion < currentVersion) {
    return false;
  }

  return true;
}

function applySnapshot(nextSnapshot, options = {}) {
  if (!shouldAcceptSnapshot(nextSnapshot, options)) {
    return false;
  }

  state.snapshot = nextSnapshot;
  state.currentGameId = nextSnapshot.gameId || state.currentGameId;
  syncCurrentGameName();

  if (nextSnapshot.playerId) {
    setPlayerIdentity(nextSnapshot.playerId);
  } else if (options.clearPlayerIdentity !== false) {
    clearPlayerIdentity();
  }

  return true;
}

async function send(path, payload = {}, options = {}) {
  const response = await fetch(path, {
    method: options.method || "POST",
    headers: { "Content-Type": "application/json" },
    body: options.method === "GET" ? undefined : JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409 && data.code === "VERSION_CONFLICT" && data.state) {
      applySnapshot(data.state, { clearPlayerIdentity: false });
      await loadGameList();
      throw new Error(translateServerMessage(data, t("game.errors.versionConflict")));
    }
    throw new Error(translateServerMessage(data, t("errors.requestFailed")));
  }

  return data;
}

async function loadState() {
  if (!state.currentGameId) {
    render();
    return;
  }

  try {
    const data = await fetchLatestStateSnapshot();
    applySnapshot(data);
    render();
  } catch (error) {
    if (!state.snapshot) {
      state.currentGameId = null;
      state.currentGameName = null;
    }
    render();
    throw error;
  }
}

async function loadGameList() {
  state.gameListState = "loading";
  state.gameListError = "";
  render();

  try {
    const requestedId = pendingRequestedGameId || requestedGameIdFromRoute();
    const query = state.currentGameId ? "?gameId=" + encodeURIComponent(state.currentGameId) : "";
    const response = await fetch("/api/games" + query);
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(translateServerMessage(payload, t("lobby.errors.loadGames")));
    }

    const data = await response.json();
    state.gameList = data.games || [];
    const activeGame = state.gameList.find((game) => game.id === data.activeGameId) || null;
    const canAutoSelectActiveGame = !activeGame
      || !activeGame.creatorUserId
      || activeGame.creatorUserId === state.user?.id;
    if (!requestedId) {
      state.currentGameId = canAutoSelectActiveGame ? (data.activeGameId || state.currentGameId) : null;
    } else if (state.currentGameId && !state.gameList.some((game) => game.id === state.currentGameId)) {
      state.currentGameId = null;
    }
    syncCurrentGameName();
    if (!state.selectedGameId || !state.gameList.some((game) => game.id === state.selectedGameId)) {
      updateGameSelection(state.currentGameId || state.gameList[0]?.id || null);
    }
    state.gameListState = state.gameList.length ? "ready" : "empty";
  } catch (error) {
    state.gameList = [];
    state.gameListState = "error";
    state.gameListError = error.message || t("lobby.errors.loadGames");
  }

  render();
}

async function restoreSession() {
  try {
    const response = await fetch("/api/auth/session");
    if (!response.ok) {
      throw new Error(t("auth.sessionExpired"));
    }

    const data = await response.json();
    setSession(data.user);
  } catch (error) {
    setSession(null);
    clearPlayerIdentity();
  }

  render();
}

function disconnectLiveUpdates() {
  if (eventsConnection) {
    eventsConnection.close();
    eventsConnection = null;
  }
  if (snapshotPollTimer) {
    clearInterval(snapshotPollTimer);
    snapshotPollTimer = null;
  }
  snapshotPollInFlight = false;
  eventsMode = null;
}

function startSnapshotPolling() {
  if (snapshotPollTimer) {
    clearInterval(snapshotPollTimer);
  }
  snapshotPollTimer = setInterval(async () => {
    if (snapshotPollInFlight) {
      return;
    }

    snapshotPollInFlight = true;
    try {
      const data = await fetchLatestStateSnapshot();
      applySnapshot(data);
      render();
    } catch (error) {
    } finally {
      snapshotPollInFlight = false;
    }
  }, 3000);
}

function connectEvents() {
  disconnectLiveUpdates();
  eventsGameId = state.currentGameId || null;
  const params = new URLSearchParams();
  if (state.currentGameId) {
    params.set("gameId", state.currentGameId);
  }
  const query = params.toString() ? "?" + params.toString() : "";
  eventsMode = "sse";
  const events = new EventSource("/api/events" + query);
  eventsConnection = events;
  events.onmessage = (event) => {
    applySnapshot(JSON.parse(event.data));
    render();
  };
  events.onerror = () => {
    if (eventsConnection === events) {
      disconnectLiveUpdates();
    }
  };
}

function ensureEventConnection() {
  const nextMode = "sse";
  if ((state.currentGameId || null) !== eventsGameId || eventsMode !== nextMode) {
    connectEvents();
  }
}

async function handleCreateGame() {
  try {
    const data = await send("/api/games", { name: elements.gameName?.value.trim() || undefined });
    state.snapshot = data.state;
    state.gameList = data.games || [];
    state.currentGameId = data.activeGameId || null;
    state.currentGameName = data.game?.name || null;
    updateGameSelection(state.currentGameId);
    state.gameListState = state.gameList.length ? "ready" : "empty";
    clearPlayerIdentity();
    if (elements.gameName) {
      elements.gameName.value = "";
    }
    render();
  } catch (error) {
    state.gameListState = "error";
    state.gameListError = error.message;
    render();
    alert(error.message);
  }
}

async function openGameById(gameId) {
  const data = await send("/api/games/open", { gameId });
  state.snapshot = data.state;
  state.gameList = data.games || [];
  state.currentGameId = data.activeGameId || null;
  state.currentGameName = data.game?.name || null;
  updateGameSelection(state.currentGameId);
  state.gameListState = state.gameList.length ? "ready" : "empty";
  if (data.playerId) {
    setPlayerIdentity(data.playerId);
  } else {
    clearPlayerIdentity();
  }
  render();
  ensureEventConnection();
  if (state.user) {
    await loadState().catch(() => {});
  }
}

async function handleOpenSelectedGame() {
  const selectedId = state.selectedGameId || elements.gameList?.value;
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

async function loginWithCredentials(username, password) {
  const data = await send("/api/auth/login", { username, password });
  setSession(data.user);
  clearPlayerIdentity();
  await loadState().catch(() => {});
  await loadGameList();
  await openRequestedGameIfNeeded();
  render();
  ensureEventConnection();
}

async function openRequestedGameIfNeeded() {
  const requestedId = pendingRequestedGameId || requestedGameIdFromRoute();
  if (!requestedId) {
    return;
  }

  if (requestedId === state.currentGameId) {
    pendingRequestedGameId = null;
    return;
  }

  const requestedGame = state.gameList.find((game) => game.id === requestedId);
  if (!requestedGame) {
    return;
  }

  const canAutoOpenRequestedGame = !requestedGame.creatorUserId
    || requestedGame.creatorUserId === state.user?.id;
  if (!canAutoOpenRequestedGame) {
    pendingRequestedGameId = null;
    syncGameRoute(null);
    return;
  }

  await openGameById(requestedId);
  pendingRequestedGameId = null;
}

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = elements.authUsername.value.trim();
  const password = elements.authPassword.value;
  if (!username || !password) {
    return;
  }

  try {
    await loginWithCredentials(username, password);
  } catch (error) {
    alert(error.message);
  }
});

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

if (elements.createGameButton) {
  elements.createGameButton.addEventListener("click", handleCreateGame);
}
if (elements.createGameButtonSecondary) {
  elements.createGameButtonSecondary.addEventListener("click", handleCreateGame);
}

if (elements.openGameButton) {
  elements.openGameButton.addEventListener("click", handleOpenSelectedGame);
}
if (elements.openGameButtonSecondary) {
  elements.openGameButtonSecondary.addEventListener("click", handleOpenSelectedGame);
}

elements.logoutButton.addEventListener("click", async () => {
  try {
    await send("/api/auth/logout", {});
  } catch (error) {
  }

  setSession(null);
  disconnectLiveUpdates();
  clearPlayerIdentity();
  state.snapshot = null;
  state.currentGameId = null;
  state.currentGameName = null;
  render();
});

elements.joinButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/join", { ...currentGamePayload() });
    setPlayerIdentity(data.playerId);
    state.user = data.user;
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.startButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/start", {
      ...currentGamePayload(),
      playerId: state.playerId
    });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

if (elements.reinforceMultiButton) {
  elements.reinforceMultiButton.addEventListener("click", async () => {
    try {
      await applyReinforcements(normalizedReinforcementAmount());
    } catch (error) {
      alert(error.message);
    }
  });
}

elements.reinforceSelect.addEventListener("change", () => {
  state.selectedReinforceTerritoryId = elements.reinforceSelect.value || null;
  render();
});
if (elements.reinforceAmount) {
  elements.reinforceAmount.addEventListener("change", () => {
    elements.reinforceAmount.value = String(normalizedReinforcementAmount());
  });
}
elements.attackFrom.addEventListener("change", () => {
  state.selectedAttackFromId = elements.attackFrom.value || null;
  state.selectedAttackToId = null;
  state.selectedAttackDiceCount = "";
  render();
});
elements.attackTo.addEventListener("change", () => {
  state.selectedAttackToId = elements.attackTo.value || null;
  render();
});
elements.attackDice.addEventListener("change", () => {
  state.selectedAttackDiceCount = elements.attackDice.value || "";
  render();
});
elements.fortifyFrom.addEventListener("change", () => {
  state.selectedFortifyFromId = elements.fortifyFrom.value || null;
  state.selectedFortifyToId = null;
  render();
});
elements.fortifyTo.addEventListener("change", () => {
  state.selectedFortifyToId = elements.fortifyTo.value || null;
  render();
});
if (elements.gameList) {
  elements.gameList.addEventListener("change", () => {
    updateGameSelection(elements.gameList.value || null);
    render();
  });
}
if (elements.gameSessionList) {
  elements.gameSessionList.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-game-id]");
    if (!trigger) {
      return;
    }

    updateGameSelection(trigger.dataset.gameId);
    render();
  });
}
if (elements.gameSessionDetails) {
  elements.gameSessionDetails.addEventListener("click", (event) => {
    const trigger = event.target.closest("#open-selected-inline");
    if (!trigger) {
      return;
    }

    handleOpenSelectedGame();
  });
}
if (elements.cardTradeList) {
  elements.cardTradeList.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-card-id]");
    if (!trigger) {
      return;
    }

    const cardId = trigger.dataset.cardId;
    if (state.selectedTradeCardIds.includes(cardId)) {
      state.selectedTradeCardIds = state.selectedTradeCardIds.filter((id) => id !== cardId);
    } else if (state.selectedTradeCardIds.length < 3) {
      state.selectedTradeCardIds = [...state.selectedTradeCardIds, cardId];
    }

    state.tradeError = "";
    state.tradeSuccess = "";
    render();
  });
}
elements.map.addEventListener("click", (event) => {
  const button = event.target.closest("[data-territory-id]");
  if (!button) {
    return;
  }

  handleTerritoryClick(button.dataset.territoryId);
});

elements.attackButton.addEventListener("click", async () => {
  try {
    await executeAttack(
      elements.attackFrom.value,
      elements.attackTo.value,
      Number(elements.attackDice.value)
    );
  } catch (error) {
    alert(error.message);
  }
});

if (elements.attackBanzaiButton) {
  elements.attackBanzaiButton.addEventListener("click", async () => {
    if (state.attackBanzaiInFlight) {
      return;
    }

    try {
      await runBanzaiAttack();
    } catch (error) {
      alert(error.message);
    }
  });
}

elements.conquestButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      ...currentGamePayload(),
      playerId: state.playerId,
      type: "moveAfterConquest",
      armies: Number(elements.conquestArmies.value),
      expectedVersion: currentExpectedVersion()
    });
    state.snapshot = data.state;
    elements.conquestArmies.value = "";
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.fortifyButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      ...currentGamePayload(),
      playerId: state.playerId,
      type: "fortify",
      fromId: elements.fortifyFrom.value,
      toId: elements.fortifyTo.value,
      armies: Number(elements.fortifyArmies.value),
      expectedVersion: currentExpectedVersion()
    });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.endTurnButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      ...currentGamePayload(),
      playerId: state.playerId,
      type: "endTurn",
      expectedVersion: currentExpectedVersion()
    });
    state.snapshot = await refreshPrivateStateIfNeeded(data.state);
    if (state.snapshot?.playerId) {
      setPlayerIdentity(state.snapshot.playerId);
    }
    render();
  } catch (error) {
    alert(error.message);
  }
});

if (elements.surrenderButton) {
  elements.surrenderButton.addEventListener("click", async () => {
    const confirmed = window.confirm(t("game.runtime.confirmSurrender"));
    if (!confirmed) {
      return;
    }

    try {
      const data = await send("/api/action", {
        ...currentGamePayload(),
        playerId: state.playerId,
        type: "surrender",
        expectedVersion: currentExpectedVersion()
      });
      state.snapshot = await refreshPrivateStateIfNeeded(data.state);
      render();
    } catch (error) {
      alert(error.message);
    }
  });
}

if (elements.cardTradeButton) {
  elements.cardTradeButton.addEventListener("click", async () => {
    try {
      const data = await send("/api/cards/trade", {
        ...currentGamePayload(),
        playerId: state.playerId,
        cardIds: state.selectedTradeCardIds,
        expectedVersion: currentExpectedVersion()
      });
      state.snapshot = data.state || state.snapshot;
      state.selectedTradeCardIds = [];
      state.tradeError = "";
      state.tradeSuccess = t("game.runtime.tradeSuccess", { bonus: data.bonus });
      render();
      if (state.user) {
        await loadState().catch(() => {});
      }
    } catch (error) {
      state.tradeSuccess = "";
      state.tradeError = error.message;
      render();
    }
  });
}

pendingRequestedGameId = requestedGameIdFromRoute();
await restoreSession();
await loadGameList();
await openRequestedGameIfNeeded();
await loadState().catch(() => {});
connectEvents();

window.addEventListener("resize", queueMapBoardFit);
