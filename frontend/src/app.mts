import { closest as closestElement, maybeQuery, setMarkup } from "./core/dom.mjs";
import { mountModuleSlotSection } from "./core/module-slots.mjs";
import type {
  GameListResponse,
  MessagePayload,
  GameSnapshot,
  GameSummary,
  MutationResponse,
  PublicUser,
  SnapshotCard,
  SnapshotCombatComparison,
  SnapshotPlayer,
  SnapshotTerritory
} from "./core/types.mjs";
import { formatDate, t, translateGameLogEntries, translateMessagePayload, translateServerMessage } from "./i18n.mjs";

type GameListState = "loading" | "ready" | "empty" | "error";
type FortifySelectionMode = "from" | "to";

const state: {
  playerId: string | null;
  snapshot: GameSnapshot | null;
  user: PublicUser | null;
  currentGameId: string | null;
  currentGameName: string | null;
  selectedGameId: string | null;
  gameList: GameSummary[];
  gameListState: GameListState;
  gameListError: string;
  selectedTradeCardIds: string[];
  selectedReinforceTerritoryId: string | null;
  selectedAttackFromId: string | null;
  selectedAttackToId: string | null;
  selectedAttackDiceCount: string;
  attackBanzaiInFlight: boolean;
  selectedFortifyFromId: string | null;
  selectedFortifyToId: string | null;
  fortifySelectionMode: FortifySelectionMode;
  tradeError: string;
  tradeSuccess: string;
} = {
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
  fortifySelectionMode: "from",
  tradeError: "",
  tradeSuccess: ""
};

let pendingRequestedGameId: string | null = null;
let eventsConnection: EventSource | null = null;
let eventsGameId: string | null = null;
let eventsMode: "sse" | null = null;
let snapshotPollTimer: ReturnType<typeof setInterval> | null = null;
let snapshotPollInFlight = false;
let privateStateRefreshInFlight = false;
let renderedMapSignature: string | null = null;
type MapViewportPointer = {
  clientX: number;
  clientY: number;
};
type MapViewportState = {
  scale: number;
  translateX: number;
  translateY: number;
  maxScale: number;
  dragThreshold: number;
  activePointers: Map<number, MapViewportPointer>;
  dragPointerId: number | null;
  dragStartClientX: number;
  dragStartClientY: number;
  dragStartTranslateX: number;
  dragStartTranslateY: number;
  isDragging: boolean;
  suppressClick: boolean;
  pinchStartDistance: number | null;
  pinchStartScale: number;
  pinchStartTranslateX: number;
  pinchStartTranslateY: number;
  pinchStartCenterClientX: number;
  pinchStartCenterClientY: number;
};
const MAP_VIEWPORT_MIN_SCALE = 1;
const MAP_VIEWPORT_WHEEL_FACTOR = 1.18;
const MAP_VIEWPORT_BUTTON_STEP = 0.2;
const MAP_TERRITORY_NODE_SCALE_EXPONENT = 0.08;
const MAP_TERRITORY_NODE_MIN_SCALE = 0.94;
const mapViewportState: MapViewportState = {
  scale: MAP_VIEWPORT_MIN_SCALE,
  translateX: 0,
  translateY: 0,
  maxScale: 3,
  dragThreshold: 8,
  activePointers: new Map(),
  dragPointerId: null,
  dragStartClientX: 0,
  dragStartClientY: 0,
  dragStartTranslateX: 0,
  dragStartTranslateY: 0,
  isDragging: false,
  suppressClick: false,
  pinchStartDistance: null,
  pinchStartScale: MAP_VIEWPORT_MIN_SCALE,
  pinchStartTranslateX: 0,
  pinchStartTranslateY: 0,
  pinchStartCenterClientX: 0,
  pinchStartCenterClientY: 0
};
type RenderSectionKey =
  | "auth"
  | "sessionBrowser"
  | "gameMeta"
  | "statusSummary"
  | "players"
  | "actionPanels"
  | "log";
type RenderContext = {
  snapshot: GameSnapshot | null;
  me: SnapshotPlayer | null;
  currentPlayer: SnapshotPlayer | null;
  winner: SnapshotPlayer | null;
  inLobby: boolean;
  inReinforcement: boolean;
  inAttack: boolean;
  inFortify: boolean;
  canInteract: boolean;
  canSurrender: boolean;
  pendingConquest: GameSnapshot["pendingConquest"];
  playerHand: SnapshotCard[];
  mustTradeCards: boolean;
  showTradePanel: boolean;
  isAuthenticated: boolean;
  territories: SnapshotTerritory[];
  reinforceOptionsMarkup: string;
  selectedReinforceId: string;
  selectedAttackFromId: string;
  source: SnapshotTerritory | null;
  attackTargets: SnapshotTerritory[];
  selectedAttackToId: string;
  maxAttackDice: number;
  selectedFortifyFromId: string;
  fortifySource: SnapshotTerritory | null;
  fortifyTargets: SnapshotTerritory[];
  selectedFortifyToId: string;
  logEntries: string[];
  totalPlayers: number;
  aiCount: number;
  playerLabel: string;
};

type GameModuleSummary = {
  activeModules?: Array<{ id: string; version: string }> | null;
  gamePresetId?: string | null;
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
};
const renderSignatures: Record<RenderSectionKey, string | null> = {
  auth: null,
  sessionBrowser: null,
  gameMeta: null,
  statusSummary: null,
  players: null,
  actionPanels: null,
  log: null
};

function signaturePart(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createSignature(parts: unknown[]): string {
  return parts.map(signaturePart).join("||");
}

function shouldRenderSection(section: RenderSectionKey, signature: string): boolean {
  if (renderSignatures[section] === signature) {
    return false;
  }

  renderSignatures[section] = signature;
  return true;
}

function escapeHtml(value: unknown): string {
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

function syncGameRoute(gameId: string | null | undefined): void {
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
  authForm: document.querySelector("#auth-form") as HTMLFormElement,
  authUsername: document.querySelector("#auth-username") as HTMLInputElement,
  authPassword: document.querySelector("#auth-password") as HTMLInputElement,
  headerLoginForm: document.querySelector("#header-login-form") as HTMLFormElement | null,
  headerAuthUsername: document.querySelector("#header-auth-username") as HTMLInputElement | null,
  headerAuthPassword: document.querySelector("#header-auth-password") as HTMLInputElement | null,
  headerLoginButton: document.querySelector("#header-login-button") as HTMLButtonElement | null,
  authStatus: document.querySelector("#auth-status") as HTMLElement,
  authFeedback: document.querySelector("#auth-feedback") as HTMLElement | null,
  registerLink: document.querySelector("#register-link") as HTMLAnchorElement | null,
  loginButton: document.querySelector("#login-button") as HTMLButtonElement,
  logoutButton: document.querySelector("#logout-button") as HTMLButtonElement,
  identityStatus: document.querySelector("#identity-status") as HTMLElement,
  joinButton: document.querySelector("#join-button") as HTMLButtonElement,
  startButton: document.querySelector("#start-button") as HTMLButtonElement,
  lobbyControlsSection: document.querySelector("#lobby-controls-section") as HTMLElement | null,
  lobbyActionButtons: document.querySelector("#lobby-action-buttons") as HTMLElement | null,
  gameName: document.querySelector("#game-name") as HTMLInputElement | null,
  createGameButton: document.querySelector("#create-game-button") as HTMLButtonElement | null,
  gameList: document.querySelector("#game-list") as HTMLSelectElement | null,
  openGameButton: document.querySelector("#open-game-button") as HTMLButtonElement,
  createGameButtonSecondary: document.querySelector("#create-game-button-secondary") as HTMLButtonElement | null,
  openGameButtonSecondary: document.querySelector("#open-game-button-secondary") as HTMLButtonElement | null,
  gameStatus: document.querySelector("#game-status") as HTMLElement,
  gameMapMeta: document.querySelector("#game-map-meta") as HTMLElement,
  gameSetupMeta: document.querySelector("#game-setup-meta") as HTMLElement,
  phaseBannerValue: document.querySelector("#phase-banner-value") as HTMLElement | null,
  reinforcementBanner: document.querySelector("#reinforcement-banner") as HTMLElement | null,
  reinforcementBannerValue: document.querySelector("#reinforcement-banner-value") as HTMLElement | null,
  gameListState: document.querySelector("#game-list-state") as HTMLElement | null,
  gameSessionList: document.querySelector("#game-session-list") as HTMLElement | null,
  gameSessionDetails: document.querySelector("#game-session-details") as HTMLElement | null,
  selectedGameStatus: document.querySelector("#selected-game-status") as HTMLElement | null,
  turnBadge: document.querySelector("#turn-badge") as HTMLElement,
  statusSummary: document.querySelector("#status-summary") as HTMLElement,
  tradeAlert: document.querySelector("#trade-alert") as HTMLElement | null,
  tradeAlertText: document.querySelector("#trade-alert-text") as HTMLElement | null,
  players: document.querySelector("#players") as HTMLElement,
  map: document.querySelector("#map") as HTMLElement,
  reinforceGroup: document.querySelector("#reinforce-group") as HTMLElement | null,
  reinforceSelect: document.querySelector("#reinforce-select") as HTMLSelectElement,
  reinforceAmount: document.querySelector("#reinforce-amount") as HTMLInputElement | null,
  reinforceMultiButton: document.querySelector("#reinforce-multi-button") as HTMLButtonElement | null,
  reinforceAllButton: document.querySelector("#reinforce-all-button") as HTMLButtonElement | null,
  attackGroup: document.querySelector("#attack-group") as HTMLElement | null,
  attackFrom: document.querySelector("#attack-from") as HTMLSelectElement,
  attackTo: document.querySelector("#attack-to") as HTMLSelectElement,
  attackDice: document.querySelector("#attack-dice") as HTMLSelectElement,
  attackButton: document.querySelector("#attack-button") as HTMLButtonElement,
  attackBanzaiButton: document.querySelector("#attack-banzai-button") as HTMLButtonElement | null,
  conquestGroup: document.querySelector("#conquest-group") as HTMLElement | null,
  conquestArmies: document.querySelector("#conquest-armies") as HTMLInputElement | null,
  conquestButton: document.querySelector("#conquest-button") as HTMLButtonElement,
  conquestAllButton: document.querySelector("#conquest-all-button") as HTMLButtonElement | null,
  fortifyGroup: document.querySelector("#fortify-group") as HTMLElement | null,
  fortifyFrom: document.querySelector("#fortify-from") as HTMLSelectElement,
  fortifyTo: document.querySelector("#fortify-to") as HTMLSelectElement,
  fortifyArmies: document.querySelector("#fortify-armies") as HTMLInputElement,
  fortifyButton: document.querySelector("#fortify-button") as HTMLButtonElement,
  cardTradeGroup: document.querySelector("#card-trade-group") as HTMLElement | null,
  cardTradeAlert: document.querySelector("#card-trade-alert") as HTMLElement | null,
  cardTradeList: document.querySelector("#card-trade-list") as HTMLElement | null,
  cardTradeSummary: document.querySelector("#card-trade-summary") as HTMLElement,
  cardTradeBonus: document.querySelector("#card-trade-bonus") as HTMLElement,
  cardTradeHelp: document.querySelector("#card-trade-help") as HTMLElement,
  cardTradeSuccess: document.querySelector("#card-trade-success") as HTMLElement,
  cardTradeError: document.querySelector("#card-trade-error") as HTMLElement,
  cardTradeButton: document.querySelector("#card-trade-button") as HTMLButtonElement | null,
  combatResultGroup: document.querySelector("#combat-result-group") as HTMLElement | null,
  combatResultBadge: document.querySelector("#combat-result-badge") as HTMLElement,
  combatResultSummary: document.querySelector("#combat-result-summary") as HTMLElement,
  combatAttackerRolls: document.querySelector("#combat-attacker-rolls") as HTMLElement,
  combatDefenderRolls: document.querySelector("#combat-defender-rolls") as HTMLElement,
  combatComparisons: document.querySelector("#combat-comparisons") as HTMLElement,
  actionHint: document.querySelector("#action-hint") as HTMLElement | null,
  endTurnButton: document.querySelector("#end-turn-button") as HTMLButtonElement,
  surrenderButton: document.querySelector("#surrender-button") as HTMLButtonElement | null,
  log: document.querySelector("#log") as HTMLElement
};

function setHeaderAuthFeedback(message = ""): void {
  if (!message) {
    window.netriskShell?.clearHeaderAuthFeedback?.();
    return;
  }

  window.netriskShell?.setHeaderAuthFeedback?.(message, "error");
}

function setInlineAuthFeedback(message = "", tone: "error" | "success" = "error"): void {
  if (!elements.authFeedback) {
    return;
  }

  if (!message) {
    elements.authFeedback.hidden = true;
    elements.authFeedback.textContent = "";
    elements.authFeedback.className = "auth-feedback";
    return;
  }

  elements.authFeedback.hidden = false;
  elements.authFeedback.textContent = message;
  elements.authFeedback.className = `auth-feedback is-${tone}`;
}

function renderNavAvatar(username: string | null | undefined): void {
  const avatar = maybeQuery("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

let pendingMapFitFrame: number | null = null;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function mapViewportElements() {
  const surface = elements.map.querySelector("[data-map-surface]") as HTMLElement | null;
  const anchor = elements.map.querySelector("[data-map-anchor]") as HTMLElement | null;
  const transform = elements.map.querySelector("[data-map-transform]") as HTMLElement | null;
  const board = elements.map.querySelector(".map-board") as HTMLElement | null;
  const markers = elements.map.querySelector("[data-map-markers]") as HTMLElement | null;
  const zoomInButton = elements.map.querySelector('[data-map-control="zoom-in"]') as HTMLButtonElement | null;
  const zoomOutButton = elements.map.querySelector('[data-map-control="zoom-out"]') as HTMLButtonElement | null;
  const resetButton = elements.map.querySelector('[data-map-control="reset"]') as HTMLButtonElement | null;

  return {
    surface,
    anchor,
    transform,
    board,
    markers,
    zoomInButton,
    zoomOutButton,
    resetButton
  };
}

function mapViewportLocalPoint(surface: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const surfaceRect = surface.getBoundingClientRect();
  return {
    x: clientX - surfaceRect.left,
    y: clientY - surfaceRect.top
  };
}

function clampMapViewportTranslation(
  translateX: number,
  translateY: number,
  scale = mapViewportState.scale
): { x: number; y: number } {
  const { surface, board } = mapViewportElements();
  if (!surface || !board) {
    return { x: translateX, y: translateY };
  }

  const overflowX = Math.max(0, (board.offsetWidth * scale - surface.clientWidth) / 2);
  const overflowY = Math.max(0, (board.offsetHeight * scale - surface.clientHeight) / 2);

  return {
    x: clampNumber(translateX, -overflowX, overflowX),
    y: clampNumber(translateY, -overflowY, overflowY)
  };
}

function positionMapMarkers(): void {
  const { surface, board, markers } = mapViewportElements();
  if (!surface || !board || !markers) {
    return;
  }

  const boardWidth = board.offsetWidth;
  const boardHeight = board.offsetHeight;
  const centerX = surface.clientWidth / 2 + mapViewportState.translateX;
  const centerY = surface.clientHeight / 2 + mapViewportState.translateY;

  markers.querySelectorAll<HTMLElement>("[data-territory-id]").forEach((node) => {
    const positionX = Number(node.dataset.mapPositionX || "0");
    const positionY = Number(node.dataset.mapPositionY || "0");
    const left = centerX + (positionX / 100 - 0.5) * boardWidth * mapViewportState.scale;
    const top = centerY + (positionY / 100 - 0.5) * boardHeight * mapViewportState.scale;
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  });
}

function applyMapViewport(): void {
  const { surface, anchor, transform, zoomInButton, zoomOutButton, resetButton } = mapViewportElements();
  if (!surface || !anchor || !transform) {
    return;
  }

  const nextScale = clampNumber(mapViewportState.scale, MAP_VIEWPORT_MIN_SCALE, mapViewportState.maxScale);
  const clampedTranslation = clampMapViewportTranslation(
    mapViewportState.translateX,
    mapViewportState.translateY,
    nextScale
  );

  mapViewportState.scale = nextScale;
  mapViewportState.translateX = clampedTranslation.x;
  mapViewportState.translateY = clampedTranslation.y;

  anchor.style.transform = `translate(-50%, -50%) translate(${mapViewportState.translateX}px, ${mapViewportState.translateY}px)`;
  transform.style.transform = `scale(${mapViewportState.scale})`;

  surface.classList.toggle("is-zoomed", mapViewportState.scale > MAP_VIEWPORT_MIN_SCALE + 0.001);
  surface.classList.toggle("is-dragging", mapViewportState.isDragging);
  surface.dataset.mapScale = mapViewportState.scale.toFixed(3);
  const territoryNodeScale = Math.max(
    MAP_TERRITORY_NODE_MIN_SCALE,
    Math.pow(1 / mapViewportState.scale, MAP_TERRITORY_NODE_SCALE_EXPONENT)
  );
  surface.dataset.mapNodeScale = territoryNodeScale.toFixed(4);
  surface.dataset.mapTranslateX = mapViewportState.translateX.toFixed(2);
  surface.dataset.mapTranslateY = mapViewportState.translateY.toFixed(2);
  surface.style.setProperty("--map-territory-node-scale", territoryNodeScale.toFixed(4));
  positionMapMarkers();

  if (zoomInButton) {
    zoomInButton.disabled = mapViewportState.scale >= mapViewportState.maxScale - 0.001;
  }
  if (zoomOutButton) {
    zoomOutButton.disabled = mapViewportState.scale <= MAP_VIEWPORT_MIN_SCALE + 0.001;
  }
  if (resetButton) {
    resetButton.disabled =
      mapViewportState.scale <= MAP_VIEWPORT_MIN_SCALE + 0.001 &&
      Math.abs(mapViewportState.translateX) < 0.5 &&
      Math.abs(mapViewportState.translateY) < 0.5;
  }
}

function setMapViewport(scale: number, translateX: number, translateY: number): void {
  const nextScale = clampNumber(scale, MAP_VIEWPORT_MIN_SCALE, mapViewportState.maxScale);
  const clampedTranslation = clampMapViewportTranslation(translateX, translateY, nextScale);
  mapViewportState.scale = nextScale;
  mapViewportState.translateX = clampedTranslation.x;
  mapViewportState.translateY = clampedTranslation.y;
  applyMapViewport();
}

function clearMapViewportInteraction(): void {
  mapViewportState.activePointers.clear();
  mapViewportState.dragPointerId = null;
  mapViewportState.isDragging = false;
  mapViewportState.pinchStartDistance = null;
}

function resetMapViewport(): void {
  clearMapViewportInteraction();
  mapViewportState.suppressClick = false;
  setMapViewport(MAP_VIEWPORT_MIN_SCALE, 0, 0);
}

function zoomMapViewportTo(scale: number, clientX: number, clientY: number): void {
  const { surface } = mapViewportElements();
  if (!surface) {
    return;
  }

  const nextScale = clampNumber(scale, MAP_VIEWPORT_MIN_SCALE, mapViewportState.maxScale);
  if (Math.abs(nextScale - mapViewportState.scale) < 0.001) {
    return;
  }

  const localPoint = mapViewportLocalPoint(surface, clientX, clientY);
  const currentCenterX = surface.clientWidth / 2 + mapViewportState.translateX;
  const currentCenterY = surface.clientHeight / 2 + mapViewportState.translateY;
  const contentX = (localPoint.x - currentCenterX) / mapViewportState.scale;
  const contentY = (localPoint.y - currentCenterY) / mapViewportState.scale;
  const nextTranslateX = localPoint.x - surface.clientWidth / 2 - contentX * nextScale;
  const nextTranslateY = localPoint.y - surface.clientHeight / 2 - contentY * nextScale;

  setMapViewport(nextScale, nextTranslateX, nextTranslateY);
}

function zoomMapViewportByStep(direction: 1 | -1): void {
  const { surface } = mapViewportElements();
  if (!surface) {
    return;
  }

  const nextScale = clampNumber(
    mapViewportState.scale + direction * MAP_VIEWPORT_BUTTON_STEP,
    MAP_VIEWPORT_MIN_SCALE,
    mapViewportState.maxScale
  );
  const surfaceRect = surface.getBoundingClientRect();
  zoomMapViewportTo(nextScale, surfaceRect.left + surface.clientWidth / 2, surfaceRect.top + surface.clientHeight / 2);
}

function activeMapViewportPointers(): Array<[number, MapViewportPointer]> {
  return Array.from(mapViewportState.activePointers.entries());
}

function beginMapViewportPinch(): void {
  const pointers = activeMapViewportPointers();
  if (pointers.length < 2) {
    return;
  }

  const first = pointers[0][1];
  const second = pointers[1][1];
  mapViewportState.pinchStartDistance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  mapViewportState.pinchStartScale = mapViewportState.scale;
  mapViewportState.pinchStartTranslateX = mapViewportState.translateX;
  mapViewportState.pinchStartTranslateY = mapViewportState.translateY;
  mapViewportState.pinchStartCenterClientX = (first.clientX + second.clientX) / 2;
  mapViewportState.pinchStartCenterClientY = (first.clientY + second.clientY) / 2;
  mapViewportState.isDragging = false;
  mapViewportState.dragPointerId = null;
  applyMapViewport();
}

function handleMapViewportControl(action: string | null | undefined): void {
  if (action === "zoom-in") {
    zoomMapViewportByStep(1);
    return;
  }
  if (action === "zoom-out") {
    zoomMapViewportByStep(-1);
    return;
  }
  if (action === "reset") {
    resetMapViewport();
  }
}

function fitMapBoardToViewport() {
  const mapStage = document.querySelector(".game-map-stage") as HTMLElement | null;
  const mapContainer = document.querySelector(".game-map-stage .map") as HTMLElement | null;
  const mapSurface = document.querySelector(".game-map-stage [data-map-surface]") as HTMLElement | null;
  const mapBoard = document.querySelector(".game-map-stage .map-board") as HTMLElement | null;
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
  if (mapSurface) {
    mapSurface.style.height = `${Math.ceil(height)}px`;
  }
  applyMapViewport();
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

function territoryPosition(territory: SnapshotTerritory | { id: string; x?: number | null; y?: number | null } | null): { x: number; y: number } | null {
  if (territory && Number.isFinite(territory.x) && Number.isFinite(territory.y)) {
    const x = Number(territory.x);
    const y = Number(territory.y);
    return { x: x * 100, y: y * 100 };
  }

  return territory ? classicMapLayout[territory.id as keyof typeof classicMapLayout] || null : null;
}

function ownerById(ownerId: string | null | undefined): SnapshotPlayer | null {
  return state.snapshot?.players.find((player) => player.id === ownerId) || null;
}

function textColorForBackground(color: string | null | undefined): string {
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

function pieceSkinRenderStyleForSnapshot(snapshot: GameSnapshot | null | undefined): string {
  const renderStyleId = snapshot?.gameConfig?.pieceSkin?.renderStyleId;
  return typeof renderStyleId === "string" && renderStyleId
    ? renderStyleId
    : "solid-fill";
}

function pieceSkinClassName(renderStyleId: string | null | undefined): string {
  const normalized = typeof renderStyleId === "string" && renderStyleId
    ? renderStyleId
    : "solid-fill";
  return `piece-skin-style-${normalized.replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}`;
}

function territoryById(territoryId: string | null | undefined): SnapshotTerritory | null {
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
    const username = state.user.username;
    return state.snapshot.players.find((player) => player.name === username) || null;
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
  const snapshot = state.snapshot;
  return snapshot && Number.isInteger(snapshot.version) ? snapshot.version : undefined;
}

function currentGamePayload() {
  return state.currentGameId ? { gameId: state.currentGameId } : {};
}

function currentPlayerHand() {
  return Array.isArray(state.snapshot?.playerHand) ? state.snapshot.playerHand : [];
}

function ensurePrivateStateFresh(currentPlayer: SnapshotPlayer | null): void {
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

async function refreshPrivateStateIfNeeded(nextState: GameSnapshot): Promise<GameSnapshot> {
  if (!state.user || !nextState?.players?.length) {
    return nextState;
  }

  const currentPlayerId = state.playerId || resolveCurrentPlayer()?.id || null;
  const currentPlayer = nextState.players.find((player) => player.id === currentPlayerId) || null;
  const hand = Array.isArray(nextState.playerHand) ? nextState.playerHand : [];
  const currentPlayerCardCount = Number.isInteger(currentPlayer?.cardCount) ? Number(currentPlayer?.cardCount) : null;
  if (!currentPlayer || currentPlayerCardCount == null || hand.length >= currentPlayerCardCount) {
    return nextState;
  }

  let latestState = nextState;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      latestState = await fetchLatestStateSnapshot({ includeGameId: false });
      const latestHand = Array.isArray(latestState.playerHand) ? latestState.playerHand : [];
      if (latestHand.length >= currentPlayerCardCount) {
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

function selectOrFallback<T extends { id: string }>(selectedId: string | null | undefined, options: T[], fallbackId = ""): string {
  if (selectedId && options.some((option) => option.id === selectedId)) {
    return selectedId;
  }

  return fallbackId || options[0]?.id || "";
}

function attackDiceOptions(maxDice: number): string {
  if (maxDice < 1) {
    return '<option value="">' + t("game.runtime.noDiceAvailable") + '</option>';
  }

  return Array.from({ length: maxDice }, (_, index) => {
    const value = String(index + 1);
    return '<option value="' + value + '">' + t("game.runtime.attackDiceOption", { count: value, suffix: value === "1" ? "" : "i" }) + '</option>';
  }).join("");
}

function cardTypeLabel(type: string | null | undefined): string {
  const labels: Record<string, string> = {
    infantry: t("game.runtime.cardType.infantry"),
    cavalry: t("game.runtime.cardType.cavalry"),
    artillery: t("game.runtime.cardType.artillery"),
    wild: t("game.runtime.cardType.wild")
  };
  return type ? (labels[type] || String(type)) : t("game.runtime.cardType.default");
}

function cardDisplayLabel(card: SnapshotCard): string {
  const territoryName = card.territoryId ? (territoryById(card.territoryId)?.name || card.territoryId) : null;
  return territoryName ? `${cardTypeLabel(card.type)} · ${territoryName}` : cardTypeLabel(card.type);
}

function formatDiceList(rolls: number[] | null | undefined): string {
  return Array.isArray(rolls) && rolls.length ? rolls.join(" · ") : "-";
}

function formatCombatComparisons(comparisons: SnapshotCombatComparison[] | null | undefined): string {
  if (!Array.isArray(comparisons) || !comparisons.length) {
    return "-";
  }

  return comparisons.map((comparison) => comparison.winner === "attacker" ? "A" : "D").join(" · ");
}

function setSession(user: PublicUser | null | undefined): void {
  state.user = user || null;
  window.netriskTheme?.applyUserTheme?.(state.user);
}

function clearPlayerIdentity() {
  state.playerId = null;
  localStorage.removeItem("frontline-player-id");
}

function setPlayerIdentity(playerId: string): void {
  state.playerId = playerId;
  localStorage.setItem("frontline-player-id", playerId);
}

function territoryOptionLabel(territory: SnapshotTerritory): string {
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
  const maxAllowed = Math.max(1, maximumReinforcementAmount());
  const normalized = Number.isFinite(rawValue) ? rawValue : 1;
  return Math.max(1, Math.min(normalized, maxAllowed));
}

function maximumReinforcementAmount(): number {
  const rawValue = Number(state.snapshot?.reinforcementPool || 0);
  return Number.isFinite(rawValue) ? Math.max(0, Math.floor(rawValue)) : 0;
}

function maximumPendingConquestArmies(): number {
  const pendingConquest = state.snapshot?.pendingConquest;
  if (!pendingConquest) {
    return 0;
  }

  const rawValue = Number(pendingConquest.maxArmies ?? pendingConquest.minArmies ?? 0);
  return Number.isFinite(rawValue) ? Math.max(0, Math.floor(rawValue)) : 0;
}

function normalizedConquestArmiesAmount() {
  const pendingConquest = state.snapshot?.pendingConquest;
  if (!pendingConquest) {
    return 0;
  }

  const minAllowed = Math.max(1, Number(pendingConquest.minArmies || 1));
  const maxAllowed = Math.max(minAllowed, maximumPendingConquestArmies());
  const rawValue = Number.parseInt(elements.conquestArmies?.value || String(minAllowed), 10);
  const normalized = Number.isFinite(rawValue) ? rawValue : minAllowed;
  return Math.max(minAllowed, Math.min(normalized, maxAllowed));
}

function moveAllActionLabel(count: number): string {
  return t("game.actions.moveAll", { count: Math.max(0, Math.floor(Number(count) || 0)) });
}

async function applyReinforcements(times: number): Promise<void> {
  const total = Math.max(1, Math.floor(Number(times) || 1));
  const data = await send("/api/action", {
    ...currentGamePayload(),
    playerId: state.playerId,
    type: "reinforce",
    territoryId: elements.reinforceSelect.value,
    amount: total,
    expectedVersion: currentExpectedVersion()
  });
  state.snapshot = data.state || state.snapshot;
  render();
}

async function executeAttack(fromId: string, toId: string, attackDice: number): Promise<GameSnapshot | undefined> {
  const data = await send("/api/action", {
    ...currentGamePayload(),
    playerId: state.playerId,
    type: "attack",
    fromId,
    toId,
    attackDice,
    expectedVersion: currentExpectedVersion()
  });
  const nextState = data.state;
  state.snapshot = nextState || state.snapshot;
  if (!nextState?.pendingConquest && elements.conquestArmies) {
    elements.conquestArmies.value = "";
  }
  render();
  return nextState;
}

async function moveAfterConquest(armies: number): Promise<void> {
  const data = await send("/api/action", {
    ...currentGamePayload(),
    playerId: state.playerId,
    type: "moveAfterConquest",
    armies: Math.max(1, Math.floor(Number(armies) || 1)),
    expectedVersion: currentExpectedVersion()
  });
  state.snapshot = data.state || state.snapshot;
  if (elements.conquestArmies) {
    elements.conquestArmies.value = "";
  }
  render();
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
    const nextState = data.state;
    state.snapshot = nextState || state.snapshot;
    if (!nextState?.pendingConquest && elements.conquestArmies) {
      elements.conquestArmies.value = "";
    }
    render();
  } finally {
    state.attackBanzaiInFlight = false;
    render();
  }
}

function formatUpdatedTime(value: string | null | undefined): string {
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

function phaseLabel(phase: string | null | undefined): string {
  if (phase === "active") {
    return t("common.phase.active");
  }
  if (phase === "finished") {
    return t("common.phase.finished");
  }
  return t("common.phase.lobby");
}

function selectedProfileIds(summary: GameModuleSummary | null | undefined): string[] {
  return [
    summary?.contentProfileId,
    summary?.gameplayProfileId,
    summary?.uiProfileId
  ].filter((value): value is string => Boolean(value));
}

function gameMetaModuleSummary(summary: GameModuleSummary | null | undefined): string {
  if (!summary) {
    return "";
  }

  const parts: string[] = [];
  if (summary.gamePresetId) {
    parts.push(t("game.runtime.modularPreset", { id: summary.gamePresetId }));
  }

  const profileIds = selectedProfileIds(summary);
  if (profileIds.length) {
    parts.push(t("game.runtime.modularProfiles", { count: profileIds.length }));
  }

  const moduleCount = Array.isArray(summary.activeModules) ? summary.activeModules.length : 0;
  if (moduleCount > 0) {
    parts.push(t("game.runtime.modularModules", { count: moduleCount }));
  }

  return parts.join(" · ");
}

function selectedGame() {
  const selectedId = state.selectedGameId || state.currentGameId;
  return state.gameList.find((game) => game.id === selectedId) || null;
}

function updateGameSelection(gameId: string | null | undefined): void {
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

  setMarkup(elements.gameList, state.gameList
    .map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name)}</option>`)
    .join("") || '<option value="">' + t("game.runtime.noGamesOption") + '</option>');

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

  setMarkup(elements.gameSessionList, state.gameList
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
    .join(""));

  elements.selectedGameStatus.textContent = selected ? phaseLabel(selected.phase) : t("lobby.details.emptyBadge");
  setMarkup(elements.gameSessionDetails, selected
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
    : '<div class="session-empty-copy">' + t("game.runtime.selectGameFromList") + '</div>');

  const hasSelection = Boolean(selected);
  if (elements.openGameButton) {
    elements.openGameButton.disabled = !hasSelection;
  }
  if (elements.openGameButtonSecondary) {
    elements.openGameButtonSecondary.disabled = !hasSelection;
  }
}

function buildGraphMarkup(snapshot: GameSnapshot): string {
  const renderedLinks = new Set();
  const links: string[] = [];
  const pieceSkinClass = pieceSkinClassName(pieceSkinRenderStyleForSnapshot(snapshot));

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

  const activeSelection = currentMapSelections();
  const nodes = snapshot.map
    .map((territory) => {
      const owner = ownerById(territory.ownerId);
      const position = territoryPosition(territory);
      if (!position) {
        return "";
      }
      const classes = [
        "territory-node",
        pieceSkinClass,
        territory.ownerId === state.playerId ? "is-mine" : "",
        activeSelection.sourceId === territory.id ? "is-source" : "",
        activeSelection.targetId === territory.id ? "is-target" : "",
        state.selectedReinforceTerritoryId === territory.id ? "is-reinforce" : ""
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <button
          type="button"
          class="${classes}"
          data-territory-id="${territory.id}"
          data-map-position-x="${position.x}"
          data-map-position-y="${position.y}"
          title="${escapeHtml(territory.name)}"
          aria-label="${escapeHtml(`${territory.name}: ${territory.armies} armate`)}"
          style="--owner-color:${owner?.color || "#9aa6b2"}; --owner-text-color:${textColorForBackground(owner?.color || "#9aa6b2")};"
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
    <div class="map-viewport" data-map-viewport>
      <div class="map-controls" data-map-controls>
        <button
          type="button"
          class="map-control-button"
          data-map-control="zoom-in"
          aria-label="${escapeHtml(t("game.map.zoomIn"))}"
          title="${escapeHtml(t("game.map.zoomIn"))}"
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          class="map-control-button"
          data-map-control="zoom-out"
          aria-label="${escapeHtml(t("game.map.zoomOut"))}"
          title="${escapeHtml(t("game.map.zoomOut"))}"
        >
          <span aria-hidden="true">-</span>
        </button>
        <button
          type="button"
          class="map-control-button map-control-button-reset"
          data-map-control="reset"
          aria-label="${escapeHtml(t("game.map.reset"))}"
          title="${escapeHtml(t("game.map.reset"))}"
        >
          ${escapeHtml(t("game.map.reset"))}
        </button>
      </div>
      <div class="map-board-surface" data-map-surface>
        <div class="map-board-anchor" data-map-anchor>
          <div class="map-board-transform" data-map-transform>
            <div class="${boardClasses.join(" ")}"${boardStyles.length ? ` style="${boardStyles.join("; ")}"` : ""}>
              <div class="map-board-stage">
                <svg class="map-lines" viewBox="0 0 100 100" aria-hidden="true">${links.join("")}</svg>
              </div>
            </div>
          </div>
        </div>
        <div class="map-markers-layer" data-map-markers>
          ${nodes}
        </div>
      </div>
    </div>
    <div class="map-legend">${details}</div>
  `;
}

function currentRenderedMapSignature(snapshot: GameSnapshot | null): string {
  if (!snapshot) {
    return "empty";
  }

  return [
    snapshot.gameId || "",
    Number.isInteger(snapshot.version) ? snapshot.version : "",
    state.playerId || "",
    snapshot.mapId || "",
    snapshot.gameConfig?.pieceSkin?.renderStyleId || "",
    snapshot.gameConfig?.pieceSkinId || "",
    snapshot.mapVisual?.imageUrl || "",
    snapshot.mapVisual?.aspectRatio?.width || "",
    snapshot.mapVisual?.aspectRatio?.height || "",
    snapshot.map.map((territory) => `${territory.id}:${territory.ownerId || ""}:${territory.armies}`).join(",")
  ].join("|");
}

function currentMapSelections() {
  if (state.snapshot?.turnPhase === "fortify") {
    return {
      sourceId: state.selectedFortifyFromId,
      targetId: state.selectedFortifyToId
    };
  }

  return {
    sourceId: state.selectedAttackFromId,
    targetId: state.selectedAttackToId
  };
}

function updateMapTerritoryHighlights() {
  if (!elements.map) {
    return;
  }

  const activeSelection = currentMapSelections();
  const selectedReinforceTerritoryId = state.selectedReinforceTerritoryId;

  elements.map.querySelectorAll("[data-territory-id]").forEach((node) => {
    const territoryId = node.getAttribute("data-territory-id");
    const territory = territoryById(territoryId);
    node.classList.toggle("is-mine", territory?.ownerId === state.playerId);
    node.classList.toggle("is-source", territoryId === activeSelection.sourceId);
    node.classList.toggle("is-target", territoryId === activeSelection.targetId);
    node.classList.toggle("is-reinforce", territoryId === selectedReinforceTerritoryId);
  });
}

function handleTerritoryClick(territoryId: string | null | undefined): void {
  const territory = territoryById(territoryId);
  if (!territory) {
    return;
  }

  if (state.snapshot?.turnPhase === "fortify") {
    if (territory.ownerId !== state.playerId) {
      return;
    }

    const fortifySource = territoryById(state.selectedFortifyFromId);
    const canSelectFortifyTarget =
      state.fortifySelectionMode === "to" &&
      fortifySource &&
      territory.id !== fortifySource.id &&
      fortifySource.neighbors.includes(territory.id);

    if (canSelectFortifyTarget) {
      state.selectedFortifyToId = territory.id;
      state.fortifySelectionMode = "from";
    } else {
      state.selectedFortifyFromId = territory.id;
      state.selectedFortifyToId = null;
      state.fortifySelectionMode = "to";
    }

    render();
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

function prepareRenderContext(): RenderContext {
  const snapshot = state.snapshot;
  if (snapshot?.turnPhase !== "fortify") {
    state.fortifySelectionMode = "from";
  }
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
  const inReinforcement = snapshot?.turnPhase === "reinforcement";
  const inAttack = snapshot?.turnPhase === "attack";
  const inFortify = snapshot?.turnPhase === "fortify";
  const playerHand = currentPlayerHand();
  state.selectedTradeCardIds = state.selectedTradeCardIds.filter((cardId) => playerHand.some((card) => card.id === cardId));
  if (!playerHand.length) {
    state.tradeError = "";
    state.tradeSuccess = "";
  }

  syncCurrentGameName();
  const totalPlayers = snapshot?.gameConfig?.totalPlayers || 2;
  const aiCount = Array.isArray(snapshot?.gameConfig?.players)
    ? snapshot.gameConfig.players.filter((player) => player.type === "ai").length
    : 0;
  const playerLabel = totalPlayers === 1 ? t("game.runtime.playerSingle") : t("game.runtime.playerPlural");
  const territories = myTerritories();
  const reinforceOptionsMarkup = territories
    .map((territory) => `<option value="${territory.id}">${territoryOptionLabel(territory)}</option>`)
    .join("");
  const selectedReinforceId = selectOrFallback(state.selectedReinforceTerritoryId, territories);
  state.selectedReinforceTerritoryId = selectedReinforceId || null;

  const selectedAttackFromId = selectOrFallback(state.selectedAttackFromId, territories, selectedReinforceId);
  state.selectedAttackFromId = selectedAttackFromId || null;

  const source = snapshot?.map.find((territory) => territory.id === selectedAttackFromId) || null;
  const attackTargets = (snapshot?.map || []).filter(
    (territory) =>
      source?.neighbors.includes(territory.id) &&
      territory.ownerId &&
      territory.ownerId !== state.playerId
  );
  const selectedAttackToId = selectOrFallback(state.selectedAttackToId, attackTargets);
  state.selectedAttackToId = selectedAttackToId || null;

  const maxAttackDice = source
    ? Math.max(0, Math.min(currentDiceRuleSet().attackerMaxDice || 3, source.armies - 1))
    : 0;
  if (maxAttackDice > 0) {
    state.selectedAttackDiceCount = String(Math.min(Number(state.selectedAttackDiceCount || maxAttackDice), maxAttackDice));
  } else {
    state.selectedAttackDiceCount = "";
  }

  const selectedFortifyFromId = selectOrFallback(state.selectedFortifyFromId, territories, selectedReinforceId);
  state.selectedFortifyFromId = selectedFortifyFromId || null;
  const fortifySource = territoryById(selectedFortifyFromId);
  const fortifyTargets = territories.filter(
    (territory) => territory.id !== selectedFortifyFromId && fortifySource?.neighbors.includes(territory.id)
  );
  const selectedFortifyToId = selectOrFallback(state.selectedFortifyToId, fortifyTargets);
  state.selectedFortifyToId = selectedFortifyToId || null;

  const canInteract = Boolean(me) && snapshot?.phase === "active" && isCurrentPlayer();
  const canSurrender = Boolean(me && !me.eliminated) && snapshot?.phase === "active";
  const pendingConquest = snapshot?.pendingConquest || null;
  const isAuthenticated = Boolean(state.user);
  const mustTradeCards = Boolean(me) && isCurrentPlayer() && Boolean(snapshot?.cardState?.currentPlayerMustTrade);
  const showTradePanel = Boolean(playerHand.length) || mustTradeCards;

  return {
    snapshot,
    me,
    currentPlayer,
    winner,
    inLobby,
    inReinforcement,
    inAttack,
    inFortify,
    canInteract,
    canSurrender,
    pendingConquest,
    playerHand,
    mustTradeCards,
    showTradePanel,
    isAuthenticated,
    territories,
    reinforceOptionsMarkup,
    selectedReinforceId,
    selectedAttackFromId,
    source,
    attackTargets,
    selectedAttackToId,
    maxAttackDice,
    selectedFortifyFromId,
    fortifySource,
    fortifyTargets,
    selectedFortifyToId,
    logEntries: translateGameLogEntries(snapshot),
    totalPlayers,
    aiCount,
    playerLabel
  };
}

function renderAuthenticationSection(context: RenderContext): void {
  const signature = createSignature([
    context.isAuthenticated,
    state.user?.id,
    state.user?.username
  ]);
  if (!shouldRenderSection("auth", signature)) {
    return;
  }

  if (context.isAuthenticated) {
    setInlineAuthFeedback("");
    setHeaderAuthFeedback("");
  }

  elements.authStatus.textContent = state.user
    ? t("game.runtime.loggedIn", { username: state.user.username })
    : t("game.runtime.accessRequired");
  renderNavAvatar(state.user?.username);
  elements.authForm.classList.toggle("is-authenticated", context.isAuthenticated);
  elements.authUsername.hidden = context.isAuthenticated;
  elements.authPassword.hidden = context.isAuthenticated;
  elements.loginButton.hidden = context.isAuthenticated;
  elements.loginButton.disabled = context.isAuthenticated;
  if (elements.registerLink) {
    elements.registerLink.hidden = context.isAuthenticated;
    elements.registerLink.setAttribute("aria-hidden", context.isAuthenticated ? "true" : "false");
  }
  if (elements.headerLoginForm) {
    elements.headerLoginForm.hidden = context.isAuthenticated;
    if (elements.headerAuthUsername) {
      elements.headerAuthUsername.disabled = context.isAuthenticated;
    }
    if (elements.headerAuthPassword) {
      elements.headerAuthPassword.disabled = context.isAuthenticated;
    }
    if (elements.headerLoginButton) {
      elements.headerLoginButton.disabled = context.isAuthenticated;
    }
  }
  elements.logoutButton.hidden = !context.isAuthenticated;
  elements.logoutButton.disabled = !context.isAuthenticated;
}

function renderSessionBrowserSection(): void {
  const signature = createSignature([
    state.gameListState,
    state.gameListError,
    state.currentGameId,
    state.selectedGameId,
    state.gameList.map((game) => [
      game.id,
      game.name,
      game.phase,
      game.playerCount,
      game.updatedAt,
      game.creatorUserId || ""
    ])
  ]);
  if (!shouldRenderSection("sessionBrowser", signature)) {
    return;
  }

  renderGameSessionBrowser();
}

function renderGameMetaSection(context: RenderContext): void {
  syncGameRoute(state.currentGameId);

  const signature = createSignature([
    state.currentGameId,
    state.currentGameName,
    context.snapshot?.gameConfig?.mapName,
    context.snapshot?.gameConfig?.mapId,
    context.totalPlayers,
    context.aiCount,
    context.snapshot?.gameConfig?.gamePresetId,
    context.snapshot?.gameConfig?.contentProfileId,
    context.snapshot?.gameConfig?.gameplayProfileId,
    context.snapshot?.gameConfig?.uiProfileId,
    Array.isArray(context.snapshot?.gameConfig?.activeModules)
      ? context.snapshot?.gameConfig?.activeModules.map((entry) => `${entry.id}@${entry.version}`).join("|")
      : "",
    state.user?.id,
    context.me?.id,
    context.me?.name,
    context.snapshot?.phase,
    context.currentPlayer?.id,
    context.currentPlayer?.name
  ]);
  if (!shouldRenderSection("gameMeta", signature)) {
    return;
  }

  elements.gameStatus.textContent = state.currentGameId
    ? (state.currentGameName || state.currentGameId)
    : t("game.runtime.none");
  elements.gameMapMeta.textContent = context.snapshot?.gameConfig?.mapName || context.snapshot?.gameConfig?.mapId || t("common.classicMini");
  const setupMeta = t("game.runtime.setupMeta", {
    totalPlayers: context.totalPlayers,
    playerLabel: context.playerLabel,
    aiCount: context.aiCount
  });
  const modularSetupMeta = gameMetaModuleSummary(context.snapshot?.gameConfig || null);
  elements.gameSetupMeta.textContent = [setupMeta, modularSetupMeta].filter(Boolean).join(" · ");
  elements.identityStatus.textContent = state.user
    ? context.me
      ? context.me.name
      : t("game.runtime.unassigned")
    : t("game.runtime.notConnected");
  elements.turnBadge.textContent =
    !context.snapshot
      ? "Lobby"
      : context.snapshot.phase === "lobby"
        ? "Lobby"
        : context.snapshot.phase === "finished"
          ? t("game.runtime.finished")
          : context.currentPlayer
            ? t("game.runtime.turnOf", { name: context.currentPlayer.name })
            : t("game.runtime.waiting");
  if (elements.phaseBannerValue) {
    elements.phaseBannerValue.textContent = phaseLabel(context.snapshot?.phase);
  }
}

function renderStatusSummarySection(context: RenderContext): void {
  const signature = createSignature([
    context.snapshot?.phase,
    context.snapshot?.reinforcementPool,
    context.winner?.id,
    context.winner?.name
  ]);
  if (!shouldRenderSection("statusSummary", signature)) {
    return;
  }

  setMarkup(elements.statusSummary, context.snapshot
    ? `
      <div>Fase: <strong>${escapeHtml(context.snapshot.phase)}</strong></div>
      <div>${t("game.reinforcementBanner")} <strong>${context.snapshot.reinforcementPool}</strong></div>
      <div>${t("game.runtime.winner")}: <strong>${escapeHtml(context.winner ? context.winner.name : t("game.runtime.noneLower"))}</strong></div>
    `
    : "<div>" + t("game.runtime.loadingState") + "</div>");
}

function renderPlayersSection(context: RenderContext): void {
  const pieceSkinClass = pieceSkinClassName(pieceSkinRenderStyleForSnapshot(context.snapshot));
  const players = context.snapshot?.players || [];
  const existingCards = Array.from(elements.players.querySelectorAll<HTMLElement>(".player-card"));
  const signature = createSignature([
    pieceSkinClass,
    players.map((player) => [player.id])
  ]);
  if (existingCards.length === players.length && existingCards.length > 0) {
    players.forEach((player, index) => {
      const card = existingCards[index];
      if (!card) {
        return;
      }

      const strong = card.querySelector("strong");
      const stats = card.querySelectorAll("div");
      card.className = `player-card ${pieceSkinClass}`;
      card.dataset.playerId = player.id || "";
      if (strong) {
        strong.textContent = player.name;
      }
      if (stats[0]) {
        stats[0].textContent = `${t("game.runtime.territories")}: ${player.territoryCount}`;
      }
      if (stats[1]) {
        stats[1].textContent = `${t("lobby.table.status")}: ${player.eliminated ? t("game.runtime.eliminated") : t("game.runtime.active")}`;
      }
      if (stats[2]) {
        (stats[2] as HTMLElement).style.setProperty("--player-color", player.color);
      }
    });

    renderSignatures.players = signature;
    return;
  }

  if (!shouldRenderSection("players", signature)) {
    return;
  }

  setMarkup(elements.players, players
    .map(
      (player) => `
        <article class="player-card ${pieceSkinClass}" data-player-id="${escapeHtml(player.id)}">
          <strong>${escapeHtml(player.name)}</strong>
          <div>${t("game.runtime.territories")}: ${player.territoryCount}</div>
          <div>${t("lobby.table.status")}: ${player.eliminated ? t("game.runtime.eliminated") : t("game.runtime.active")}</div>
          <div class="player-card-token" style="--player-color:${player.color};"></div>
        </article>
      `
    )
    .join(""));
}

function renderMapSection(snapshot: GameSnapshot | null): void {
  const nextMapSignature = currentRenderedMapSignature(snapshot);
  if (nextMapSignature !== renderedMapSignature) {
    setMarkup(elements.map, snapshot ? buildGraphMarkup(snapshot) : "");
    renderedMapSignature = nextMapSignature;
    resetMapViewport();
    fitMapBoardToViewport();
    queueMapBoardFit();
    return;
  }

  updateMapTerritoryHighlights();
}

function renderLogSection(context: RenderContext): void {
  const signature = createSignature([context.logEntries]);
  if (!shouldRenderSection("log", signature)) {
    return;
  }

  setMarkup(elements.log, context.logEntries.map((entry) => `<li>${escapeHtml(entry)}</li>`).join(""));
}

function renderActionPanelsSection(context: RenderContext): void {
  const attackTargetsMarkup = context.attackTargets
    .map((territory) => {
      const owner = ownerById(territory.ownerId);
      return `<option value="${territory.id}">${escapeHtml(territory.name)} vs ${escapeHtml(owner?.name || "?")} (${territory.armies})</option>`;
    })
    .join("") || '<option value="">' + t("game.runtime.noTarget") + '</option>';
  const fortifyTargetsMarkup = context.fortifyTargets
    .map((territory) => `<option value="${territory.id}">${territoryOptionLabel(territory)}</option>`)
    .join("") || '<option value="">' + t("game.runtime.noAdjacentTerritory") + '</option>';
  const cardTradeMarkup = context.playerHand.length
    ? context.playerHand
      .map((card) => `<button type="button" class="card-chip${state.selectedTradeCardIds.includes(card.id) ? " is-selected" : ""}" data-card-id="${card.id}" aria-pressed="${state.selectedTradeCardIds.includes(card.id) ? "true" : "false"}"><span>${cardDisplayLabel(card)}</span></button>`)
      .join("")
    : '<p class="card-trade-empty">' + t("game.runtime.noCardsAvailable") + '</p>';
  const signature = createSignature([
    state.user?.id,
    state.playerId,
    context.snapshot?.phase,
    context.snapshot?.turnPhase,
    context.snapshot?.reinforcementPool,
    context.snapshot?.fortifyUsed,
    context.snapshot?.players.length,
    context.inLobby,
    context.inReinforcement,
    context.inAttack,
    context.inFortify,
    context.canInteract,
    context.canSurrender,
    context.pendingConquest,
    context.snapshot?.lastCombat,
    context.snapshot?.cardState,
    context.reinforceOptionsMarkup,
    context.selectedReinforceId,
    context.selectedAttackFromId,
    attackTargetsMarkup,
    context.selectedAttackToId,
    context.maxAttackDice,
    state.selectedAttackDiceCount,
    state.attackBanzaiInFlight,
    context.selectedFortifyFromId,
    fortifyTargetsMarkup,
    context.selectedFortifyToId,
    state.fortifySelectionMode,
    context.playerHand.map((card) => [card.id, card.type, card.territoryId]),
    state.selectedTradeCardIds,
    state.tradeSuccess,
    state.tradeError,
    context.mustTradeCards,
    context.showTradePanel
  ]);
  if (!shouldRenderSection("actionPanels", signature)) {
    return;
  }

  setMarkup(elements.reinforceSelect, context.reinforceOptionsMarkup || '<option value="">' + t("game.runtime.noTerritory") + '</option>');
  if (context.selectedReinforceId) {
    elements.reinforceSelect.value = context.selectedReinforceId;
  }
  if (elements.reinforceAmount) {
    const maxReinforcements = Math.max(1, maximumReinforcementAmount());
    elements.reinforceAmount.min = "1";
    elements.reinforceAmount.max = String(maxReinforcements);
    elements.reinforceAmount.value = String(normalizedReinforcementAmount());
  }
  if (elements.reinforceAllButton) {
    elements.reinforceAllButton.textContent = moveAllActionLabel(maximumReinforcementAmount());
  }

  setMarkup(elements.attackFrom, context.reinforceOptionsMarkup || '<option value="">' + t("game.runtime.noTerritory") + '</option>');
  if (context.selectedAttackFromId) {
    elements.attackFrom.value = context.selectedAttackFromId;
  }
  setMarkup(elements.attackTo, attackTargetsMarkup);
  if (context.selectedAttackToId) {
    elements.attackTo.value = context.selectedAttackToId;
  }
  setMarkup(elements.attackDice, attackDiceOptions(context.maxAttackDice));
  if (context.maxAttackDice > 0) {
    elements.attackDice.value = state.selectedAttackDiceCount;
  } else {
    elements.attackDice.value = "";
  }

  setMarkup(elements.fortifyFrom, context.reinforceOptionsMarkup || '<option value="">' + t("game.runtime.noTerritory") + '</option>');
  if (context.selectedFortifyFromId) {
    elements.fortifyFrom.value = context.selectedFortifyFromId;
  }
  setMarkup(elements.fortifyTo, fortifyTargetsMarkup);
  if (context.selectedFortifyToId) {
    elements.fortifyTo.value = context.selectedFortifyToId;
  }
  if (context.fortifySource && elements.fortifyArmies && !elements.fortifyArmies.value) {
    elements.fortifyArmies.value = "1";
  }

  if (elements.lobbyControlsSection) {
    elements.lobbyControlsSection.hidden = !context.inLobby;
  }
  if (elements.reinforcementBanner) {
    elements.reinforcementBanner.hidden = !context.canInteract || !context.inReinforcement;
  }
  if (elements.reinforcementBannerValue) {
    elements.reinforcementBannerValue.textContent = String(context.snapshot?.reinforcementPool ?? 0);
  }
  if (elements.lobbyActionButtons) {
    elements.lobbyActionButtons.hidden = !context.inLobby;
  }
  elements.joinButton.hidden = !context.inLobby;
  elements.startButton.hidden = !context.inLobby;
  elements.joinButton.disabled = !state.user || Boolean(context.me) || !context.inLobby;
  elements.startButton.disabled = !context.me || !context.inLobby || (context.snapshot?.players.length || 0) < 2;
  if (elements.createGameButton) {
    elements.createGameButton.disabled = false;
  }
  if (elements.createGameButtonSecondary) {
    elements.createGameButtonSecondary.disabled = false;
  }
  if (elements.reinforceGroup) {
    elements.reinforceGroup.hidden = !context.canInteract || !context.inReinforcement || Boolean(context.pendingConquest);
  }
  if (elements.attackGroup) {
    elements.attackGroup.hidden = !context.canInteract || !context.inAttack || Boolean(context.pendingConquest);
  }
  if (elements.conquestGroup) {
    elements.conquestGroup.hidden = !context.canInteract || !context.pendingConquest;
  }
  if (elements.fortifyGroup) {
    elements.fortifyGroup.hidden = !context.canInteract || !context.inFortify || Boolean(context.pendingConquest) || Boolean(context.snapshot?.fortifyUsed);
  }
  if (context.pendingConquest && elements.conquestArmies) {
    elements.conquestArmies.min = String(context.pendingConquest.minArmies || 1);
    elements.conquestArmies.max = String(context.pendingConquest.maxArmies || context.pendingConquest.minArmies || 1);
    if (!elements.conquestArmies.value) {
      elements.conquestArmies.value = String(context.pendingConquest.minArmies || 1);
    }
    elements.conquestArmies.value = String(normalizedConquestArmiesAmount());
  }
  if (elements.conquestAllButton) {
    elements.conquestAllButton.textContent = moveAllActionLabel(maximumPendingConquestArmies());
  }

  const lastCombat = context.snapshot?.lastCombat || null;
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
  if (elements.tradeAlert) {
    elements.tradeAlert.hidden = !context.mustTradeCards;
  }
  if (elements.tradeAlertText) {
    elements.tradeAlertText.textContent = context.mustTradeCards
      ? t("game.runtime.tradeAlert.mustTradeNow", { cardCount: context.playerHand.length, limit: context.snapshot?.cardState?.maxHandBeforeForcedTrade || 5 })
      : t("game.tradeAlert.copy");
  }
  if (elements.cardTradeGroup) {
    elements.cardTradeGroup.hidden = !context.canInteract || !context.inReinforcement || Boolean(context.pendingConquest) || !context.showTradePanel;
    if (elements.cardTradeAlert) {
      elements.cardTradeAlert.hidden = !context.mustTradeCards;
    }
    elements.cardTradeSummary.textContent = t("game.runtime.cardsInHand", { count: context.playerHand.length });
    elements.cardTradeBonus.textContent = t("game.runtime.nextTradeBonus", { bonus: context.snapshot?.cardState?.nextTradeBonus || 4 });
    if (elements.cardTradeList) {
      setMarkup(elements.cardTradeList, cardTradeMarkup);
    }
    elements.cardTradeHelp.textContent = context.mustTradeCards
      ? t("game.runtime.tradeHelp.mustTrade", { limit: context.snapshot?.cardState?.maxHandBeforeForcedTrade || 5 })
      : context.playerHand.length
        ? t("game.runtime.tradeHelp.selected", { selected: state.selectedTradeCardIds.length })
        : t("game.runtime.noCardsAvailable");
    elements.cardTradeSuccess.hidden = !state.tradeSuccess;
    elements.cardTradeSuccess.textContent = state.tradeSuccess;
    elements.cardTradeError.hidden = !state.tradeError;
    elements.cardTradeError.textContent = state.tradeError;
    if (elements.cardTradeButton) {
      elements.cardTradeButton.disabled = !context.canInteract || !context.inReinforcement || Boolean(context.pendingConquest) || state.selectedTradeCardIds.length !== 3;
    }
  }
  if (elements.reinforceAmount) {
    elements.reinforceAmount.disabled = !context.canInteract || !context.inReinforcement || Boolean(context.pendingConquest) || (context.snapshot?.reinforcementPool || 0) <= 0 || !elements.reinforceSelect.value;
  }
  if (elements.reinforceMultiButton) {
    elements.reinforceMultiButton.disabled = !context.canInteract || !context.inReinforcement || Boolean(context.pendingConquest) || (context.snapshot?.reinforcementPool || 0) <= 0 || !elements.reinforceSelect.value;
  }
  if (elements.reinforceAllButton) {
    elements.reinforceAllButton.disabled = !context.canInteract || !context.inReinforcement || Boolean(context.pendingConquest) || (context.snapshot?.reinforcementPool || 0) <= 0 || !elements.reinforceSelect.value;
  }
  elements.attackButton.disabled = !context.canInteract || !context.inAttack || Boolean(context.pendingConquest) || Boolean(state.attackBanzaiInFlight) || (context.snapshot?.reinforcementPool || 0) > 0 || !elements.attackFrom.value || !elements.attackTo.value || !elements.attackDice.value;
  if (elements.attackBanzaiButton) {
    elements.attackBanzaiButton.disabled = !context.canInteract || !context.inAttack || Boolean(context.pendingConquest) || Boolean(state.attackBanzaiInFlight) || (context.snapshot?.reinforcementPool || 0) > 0 || !elements.attackFrom.value || !elements.attackTo.value || !elements.attackDice.value;
    elements.attackBanzaiButton.textContent = state.attackBanzaiInFlight ? t("game.runtime.banzaiLoading") : t("game.actions.banzai");
  }
  elements.conquestButton.disabled = !context.canInteract || !context.pendingConquest || !elements.conquestArmies?.value;
  if (elements.conquestAllButton) {
    elements.conquestAllButton.disabled = !context.canInteract || !context.pendingConquest;
  }
  elements.fortifyButton.disabled = !context.canInteract || !context.inFortify || Boolean(context.snapshot?.fortifyUsed) || !elements.fortifyFrom.value || !elements.fortifyTo.value || !elements.fortifyArmies.value;
  elements.endTurnButton.hidden = !context.canInteract || context.inReinforcement || Boolean(context.pendingConquest);
  elements.endTurnButton.disabled = !context.canInteract || context.inReinforcement || Boolean(context.pendingConquest);
  elements.endTurnButton.textContent = context.inAttack ? t("game.runtime.goToFortify") : t("game.actions.endTurn");
  if (elements.surrenderButton) {
    elements.surrenderButton.hidden = !context.canSurrender;
    elements.surrenderButton.disabled = !context.canSurrender;
  }
  if (elements.actionHint) {
    elements.actionHint.textContent = context.canInteract
      ? context.pendingConquest
        ? t("game.runtime.conquest")
        : context.inReinforcement
          ? t("game.runtime.hint.reinforcements")
          : context.inFortify
            ? context.snapshot?.fortifyUsed
              ? t("game.runtime.hint.closeTurn")
              : t("game.actions.fortify")
            : t("game.runtime.hint.attack")
      : state.user
        ? t("game.runtime.hint.observation")
        : t("game.runtime.hint.login");
  }
}

function render() {
  const context = prepareRenderContext();
  renderAuthenticationSection(context);
  renderSessionBrowserSection();
  renderGameMetaSection(context);
  renderStatusSummarySection(context);
  renderPlayersSection(context);
  renderMapSection(context.snapshot);
  renderActionPanelsSection(context);
  renderLogSection(context);
}

async function fetchLatestStateSnapshot(options: { includeGameId?: boolean } = {}): Promise<GameSnapshot> {
  const includeGameId = options.includeGameId !== false;
  const query = includeGameId && state.currentGameId ? "?gameId=" + encodeURIComponent(state.currentGameId) : "";
  const response = await fetch("/api/state" + query);
  const data = await response.json() as GameSnapshot;
  if (!response.ok) {
    throw new Error(translateServerMessage(data as unknown as MessagePayload, t("game.errors.loadActiveGame")));
  }
  return data;
}

function shouldAcceptSnapshot(nextSnapshot: GameSnapshot | null | undefined, options: { allowGameSwitch?: boolean } = {}): boolean {
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

function applySnapshot(nextSnapshot: GameSnapshot, options: { clearPlayerIdentity?: boolean; allowGameSwitch?: boolean } = {}): boolean {
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

async function send(path: string, payload: Record<string, unknown> = {}, options: { method?: string } = {}): Promise<MutationResponse> {
  const response = await fetch(path, {
    method: options.method || "POST",
    headers: { "Content-Type": "application/json" },
    body: options.method === "GET" ? undefined : JSON.stringify(payload)
  });

  const data = await response.json() as MutationResponse;
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
  } catch (error: unknown) {
    state.gameList = [];
    state.gameListState = "error";
    state.gameListError = error instanceof Error ? error.message : t("lobby.errors.loadGames");
  }

  render();
}

async function restoreSession() {
  try {
    const response = await fetch("/api/auth/session");
    if (!response.ok) {
      throw new Error(t("auth.sessionExpired"));
    }

    const data = await response.json() as MutationResponse;
    setSession(data.user);
  } catch (_error: unknown) {
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
    state.snapshot = data.state || null;
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
  } catch (error: unknown) {
    state.gameListState = "error";
    state.gameListError = error instanceof Error ? error.message : t("errors.requestFailed");
    render();
    alert(error instanceof Error ? error.message : t("errors.requestFailed"));
  }
}

async function openGameById(gameId: string): Promise<void> {
  const data = await send("/api/games/open", { gameId });
  state.snapshot = data.state || null;
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
  } catch (error: unknown) {
    state.gameListState = "error";
    state.gameListError = error instanceof Error ? error.message : t("errors.requestFailed");
    render();
    alert(error instanceof Error ? error.message : t("errors.requestFailed"));
  }
}

async function loginWithCredentials(username: string, password: string): Promise<void> {
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
    setInlineAuthFeedback(t("auth.login.requiredFields"));
    return;
  }

  try {
    setInlineAuthFeedback("");
    setHeaderAuthFeedback("");
    await loginWithCredentials(username, password);
  } catch (error: unknown) {
    setInlineAuthFeedback(error instanceof Error ? error.message : t("errors.loginFailed"));
  }
});

if (elements.headerLoginForm) {
  (elements.headerLoginForm as HTMLElement).dataset.headerLoginManaged = "true";
  elements.headerLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = elements.headerAuthUsername?.value.trim() || "";
    const password = elements.headerAuthPassword?.value || "";
    if (!username || !password) {
      setHeaderAuthFeedback(t("auth.login.requiredFields"));
      return;
    }

    try {
      setHeaderAuthFeedback("");
      setInlineAuthFeedback("");
      await loginWithCredentials(username, password);
      if (elements.headerAuthPassword) {
        elements.headerAuthPassword.value = "";
      }
    } catch (error: unknown) {
      setHeaderAuthFeedback(error instanceof Error ? error.message : t("errors.loginFailed"));
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
  } catch (_error: unknown) {
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
    if (data.playerId) {
      setPlayerIdentity(data.playerId);
    }
    state.user = data.user || state.user;
    state.snapshot = data.state || state.snapshot;
    render();
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : t("errors.requestFailed"));
  }
});

elements.startButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/start", {
      ...currentGamePayload(),
      playerId: state.playerId
    });
    state.snapshot = data.state || state.snapshot;
    render();
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : t("errors.requestFailed"));
  }
});

if (elements.reinforceMultiButton) {
  elements.reinforceMultiButton.addEventListener("click", async () => {
    try {
      await applyReinforcements(normalizedReinforcementAmount());
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t("errors.requestFailed"));
    }
  });
}
if (elements.reinforceAllButton) {
  elements.reinforceAllButton.addEventListener("click", async () => {
    try {
      const maxReinforcements = maximumReinforcementAmount();
      if (maxReinforcements < 1) {
        return;
      }

      if (elements.reinforceAmount) {
        elements.reinforceAmount.value = String(maxReinforcements);
      }
      await applyReinforcements(maxReinforcements);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t("errors.requestFailed"));
    }
  });
}

elements.reinforceSelect.addEventListener("change", () => {
  state.selectedReinforceTerritoryId = elements.reinforceSelect.value || null;
  render();
});
if (elements.reinforceAmount) {
  elements.reinforceAmount.addEventListener("change", () => {
    if (elements.reinforceAmount) {
      elements.reinforceAmount.value = String(normalizedReinforcementAmount());
    }
  });
}
if (elements.conquestArmies) {
  elements.conquestArmies.addEventListener("change", () => {
    if (!state.snapshot?.pendingConquest || !elements.conquestArmies) {
      return;
    }

    elements.conquestArmies.value = String(normalizedConquestArmiesAmount());
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
  state.fortifySelectionMode = "to";
  render();
});
elements.fortifyTo.addEventListener("change", () => {
  state.selectedFortifyToId = elements.fortifyTo.value || null;
  state.fortifySelectionMode = "from";
  render();
});
if (elements.gameList) {
  elements.gameList.addEventListener("change", () => {
    updateGameSelection(elements.gameList?.value || null);
    render();
  });
}
if (elements.gameSessionList) {
  elements.gameSessionList.addEventListener("click", (event: Event) => {
    const trigger = closestElement<HTMLElement>(event.target, "[data-game-id]");
    if (!trigger) {
      return;
    }

    updateGameSelection(trigger.dataset.gameId);
    render();
  });
}
if (elements.gameSessionDetails) {
  elements.gameSessionDetails.addEventListener("click", (event: Event) => {
    const trigger = closestElement<HTMLElement>(event.target, "#open-selected-inline");
    if (!trigger) {
      return;
    }

    handleOpenSelectedGame();
  });
}
if (elements.cardTradeList) {
  elements.cardTradeList.addEventListener("click", (event: Event) => {
    const trigger = closestElement<HTMLElement>(event.target, "[data-card-id]");
    if (!trigger) {
      return;
    }

    const cardId = trigger.dataset.cardId;
    if (!cardId) {
      return;
    }

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
elements.map.addEventListener("click", (event: Event) => {
  const control = closestElement<HTMLElement>(event.target, "[data-map-control]");
  if (control) {
    event.preventDefault();
    handleMapViewportControl(control.dataset.mapControl);
    return;
  }

  if (mapViewportState.suppressClick) {
    event.preventDefault();
    mapViewportState.suppressClick = false;
    return;
  }

  const button = closestElement<HTMLElement>(event.target, "[data-territory-id]");
  if (!button || (event as MouseEvent).detail !== 0) {
    return;
  }

  handleTerritoryClick(button.dataset.territoryId);
});

elements.map.addEventListener(
  "wheel",
  (event: WheelEvent) => {
    const control = closestElement<HTMLElement>(event.target, "[data-map-control]");
    const surface = closestElement<HTMLElement>(event.target, "[data-map-surface]");
    if (control || !surface) {
      return;
    }

    event.preventDefault();
    const factor = event.deltaY < 0 ? MAP_VIEWPORT_WHEEL_FACTOR : 1 / MAP_VIEWPORT_WHEEL_FACTOR;
    zoomMapViewportTo(mapViewportState.scale * factor, event.clientX, event.clientY);
  },
  { passive: false }
);

elements.map.addEventListener("pointerdown", (event: PointerEvent) => {
  const control = closestElement<HTMLElement>(event.target, "[data-map-control]");
  const surface = closestElement<HTMLElement>(event.target, "[data-map-surface]");
  if (control || !surface) {
    return;
  }
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  mapViewportState.activePointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY
  });

  try {
    surface.setPointerCapture(event.pointerId);
  } catch {
  }

  if (mapViewportState.activePointers.size >= 2) {
    beginMapViewportPinch();
    return;
  }

  mapViewportState.dragPointerId = event.pointerId;
  mapViewportState.dragStartClientX = event.clientX;
  mapViewportState.dragStartClientY = event.clientY;
  mapViewportState.dragStartTranslateX = mapViewportState.translateX;
  mapViewportState.dragStartTranslateY = mapViewportState.translateY;
  mapViewportState.isDragging = false;
  applyMapViewport();
});

elements.map.addEventListener("pointermove", (event: PointerEvent) => {
  const surface = closestElement<HTMLElement>(event.target, "[data-map-surface]") || mapViewportElements().surface;
  if (!surface || !mapViewportState.activePointers.has(event.pointerId)) {
    return;
  }

  mapViewportState.activePointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY
  });

  if (mapViewportState.activePointers.size >= 2) {
    const pointers = activeMapViewportPointers();
    const first = pointers[0]?.[1];
    const second = pointers[1]?.[1];
    if (!first || !second) {
      return;
    }

    if (!mapViewportState.pinchStartDistance || mapViewportState.pinchStartDistance <= 0) {
      beginMapViewportPinch();
      return;
    }

    const currentDistance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    const currentCenterClientX = (first.clientX + second.clientX) / 2;
    const currentCenterClientY = (first.clientY + second.clientY) / 2;
    const nextScale = clampNumber(
      mapViewportState.pinchStartScale * (currentDistance / mapViewportState.pinchStartDistance),
      MAP_VIEWPORT_MIN_SCALE,
      mapViewportState.maxScale
    );
    const startCenter = mapViewportLocalPoint(
      surface,
      mapViewportState.pinchStartCenterClientX,
      mapViewportState.pinchStartCenterClientY
    );
    const currentCenter = mapViewportLocalPoint(surface, currentCenterClientX, currentCenterClientY);
    const contentX =
      (startCenter.x - surface.clientWidth / 2 - mapViewportState.pinchStartTranslateX) /
      mapViewportState.pinchStartScale;
    const contentY =
      (startCenter.y - surface.clientHeight / 2 - mapViewportState.pinchStartTranslateY) /
      mapViewportState.pinchStartScale;
    const nextTranslateX = currentCenter.x - surface.clientWidth / 2 - contentX * nextScale;
    const nextTranslateY = currentCenter.y - surface.clientHeight / 2 - contentY * nextScale;

    mapViewportState.suppressClick = true;
    setMapViewport(nextScale, nextTranslateX, nextTranslateY);
    event.preventDefault();
    return;
  }

  if (mapViewportState.dragPointerId !== event.pointerId || mapViewportState.scale <= MAP_VIEWPORT_MIN_SCALE + 0.001) {
    return;
  }

  const deltaX = event.clientX - mapViewportState.dragStartClientX;
  const deltaY = event.clientY - mapViewportState.dragStartClientY;
  if (!mapViewportState.isDragging) {
    const movedEnough = Math.hypot(deltaX, deltaY) >= mapViewportState.dragThreshold;
    if (!movedEnough) {
      return;
    }
    mapViewportState.isDragging = true;
    mapViewportState.suppressClick = true;
  }

  setMapViewport(
    mapViewportState.scale,
    mapViewportState.dragStartTranslateX + deltaX,
    mapViewportState.dragStartTranslateY + deltaY
  );
  event.preventDefault();
});

const finishMapPointerInteraction = (event: PointerEvent): void => {
  const hadSinglePointer = mapViewportState.activePointers.size === 1;
  const shouldSelectTerritory =
    event.type === "pointerup" &&
    hadSinglePointer &&
    !mapViewportState.isDragging &&
    mapViewportState.pinchStartDistance == null &&
    !mapViewportState.suppressClick;

  const { surface } = mapViewportElements();
  if (surface?.hasPointerCapture(event.pointerId)) {
    try {
      surface.releasePointerCapture(event.pointerId);
    } catch {
    }
  }

  if (!mapViewportState.activePointers.has(event.pointerId)) {
    return;
  }

  mapViewportState.activePointers.delete(event.pointerId);

  if (mapViewportState.activePointers.size >= 2) {
    beginMapViewportPinch();
    return;
  }

  mapViewportState.pinchStartDistance = null;
  mapViewportState.isDragging = false;

  const [remainingPointerId, remainingPointer] = activeMapViewportPointers()[0] || [];
  if (remainingPointerId != null && remainingPointer) {
    mapViewportState.dragPointerId = remainingPointerId;
    mapViewportState.dragStartClientX = remainingPointer.clientX;
    mapViewportState.dragStartClientY = remainingPointer.clientY;
    mapViewportState.dragStartTranslateX = mapViewportState.translateX;
    mapViewportState.dragStartTranslateY = mapViewportState.translateY;
  } else {
    mapViewportState.dragPointerId = null;
  }

  applyMapViewport();

  if (!shouldSelectTerritory) {
    return;
  }

  const releaseTarget = document.elementFromPoint(event.clientX, event.clientY);
  const territoryButton = closestElement<HTMLElement>(releaseTarget, "[data-territory-id]");
  if (!territoryButton) {
    return;
  }

  handleTerritoryClick(territoryButton.dataset.territoryId);
};

elements.map.addEventListener("pointerup", finishMapPointerInteraction);
elements.map.addEventListener("pointercancel", finishMapPointerInteraction);
elements.map.addEventListener("pointerleave", (event: PointerEvent) => {
  if (event.pointerType !== "mouse" || !mapViewportState.activePointers.has(event.pointerId)) {
    return;
  }

  finishMapPointerInteraction(event);
});

elements.attackButton.addEventListener("click", async () => {
  try {
    const attackDice = normalizedAttackDiceValue();
    if (!attackDice) {
      return;
    }

    await executeAttack(
      elements.attackFrom.value,
      elements.attackTo.value,
      attackDice
    );
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : t("errors.requestFailed"));
  }
});

if (elements.attackBanzaiButton) {
  elements.attackBanzaiButton.addEventListener("click", async () => {
    if (state.attackBanzaiInFlight) {
      return;
    }

    try {
      await runBanzaiAttack();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t("errors.requestFailed"));
    }
  });
}

elements.conquestButton.addEventListener("click", async () => {
  try {
    await moveAfterConquest(normalizedConquestArmiesAmount());
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : t("errors.requestFailed"));
  }
});
if (elements.conquestAllButton) {
  elements.conquestAllButton.addEventListener("click", async () => {
    try {
      const maxArmies = maximumPendingConquestArmies();
      if (maxArmies < 1) {
        return;
      }

      if (elements.conquestArmies) {
        elements.conquestArmies.value = String(maxArmies);
      }
      await moveAfterConquest(maxArmies);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t("errors.requestFailed"));
    }
  });
}

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
    state.snapshot = data.state || state.snapshot;
    render();
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : t("errors.requestFailed"));
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
    state.snapshot = data.state ? await refreshPrivateStateIfNeeded(data.state) : state.snapshot;
    if (state.snapshot?.playerId) {
      setPlayerIdentity(state.snapshot.playerId);
    }
    render();
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : t("errors.requestFailed"));
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
      state.snapshot = data.state ? await refreshPrivateStateIfNeeded(data.state) : state.snapshot;
      render();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t("errors.requestFailed"));
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
    } catch (error: unknown) {
      state.tradeSuccess = "";
      state.tradeError = error instanceof Error ? error.message : t("errors.requestFailed");
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
void mountModuleSlotSection({
  slotId: "game.sidebar",
  containerId: "game-module-slots",
  anchor: elements.lobbyControlsSection || elements.statusSummary,
  title: "Supporto moduli",
  copy: "Il runtime moduli puo aggiungere pannelli laterali dichiarativi anche durante la partita.",
  sectionClassName: "rail-section profile-note-card"
});

window.addEventListener("resize", queueMapBoardFit);
window.addEventListener("blur", () => {
  clearMapViewportInteraction();
  applyMapViewport();
});
