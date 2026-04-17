import { byId, closest, maybeQuery, setDisabled, setHidden, setMarkup } from "./core/dom.mjs";
import { readValidatedJson } from "./core/validated-json.mjs";
import { messageFromError } from "./core/errors.mjs";
import type {
  GameOptionsResponse,
  NetRiskModuleCapability,
  NetRiskModuleDependency,
  InstalledModuleSummary,
  ModuleOptionsResponse,
  ModulesCatalogResponse,
  NetRiskUiSlotContribution
} from "./core/types.mjs";
import {
  authSessionResponseSchema,
  loginResponseSchema,
  profileResponseSchema,
  themePreferenceResponseSchema
} from "./generated/shared-runtime-validation.mjs";
import type {
  AuthSessionResponse,
  LoginResponse,
  ProfileContract as ProfileSummary,
  ProfileResponse,
  PublicUser,
  ThemePreferenceResponse
} from "./generated/shared-runtime-validation.mjs";
import { formatDate, t, translateServerMessage } from "./i18n.mjs";

const elements = {
  profileName: byId("profile-name"),
  profileSubtitle: maybeQuery("#profile-subtitle"),
  headerLoginForm: maybeQuery("#header-login-form"),
  headerAuthUsername: maybeQuery<HTMLInputElement>("#header-auth-username"),
  headerAuthPassword: maybeQuery<HTMLInputElement>("#header-auth-password"),
  headerLoginButton: maybeQuery<HTMLButtonElement>("#header-login-button"),
  authStatus: byId("auth-status"),
  logoutButton: byId("logout-button") as HTMLButtonElement,
  profileFeedback: byId("profile-feedback"),
  profilePreferences: byId("profile-preferences"),
  themeSelect: byId("profile-theme-select") as HTMLSelectElement,
  themeStatus: byId("profile-theme-status"),
  profileModules: byId("profile-modules"),
  profileModulesStatus: byId("profile-modules-status"),
  profileModulesEmpty: byId("profile-modules-empty"),
  profileModulesList: byId("profile-modules-list"),
  profileModuleSlotsEmpty: byId("profile-module-slots-empty"),
  profileModuleSlotsList: byId("profile-module-slots-list"),
  profileModulesRefresh: byId("profile-modules-refresh") as HTMLButtonElement,
  profileModulesRescan: byId("profile-modules-rescan") as HTMLButtonElement,
  profileContent: byId("profile-content"),
  profileHeading: byId("profile-heading"),
  profileCopy: byId("profile-copy"),
  gamesPlayed: byId("metric-games-played"),
  wins: byId("metric-wins"),
  losses: byId("metric-losses"),
  inProgress: byId("metric-in-progress"),
  winRate: byId("metric-win-rate"),
  gamesCount: byId("profile-games-count"),
  gamesEmpty: byId("profile-games-empty"),
  gamesList: byId("profile-games-list"),
  profileRankingTitle: byId("profile-ranking-title"),
  profileRankingCopy: byId("profile-ranking-copy"),
  profileMapTitle: byId("profile-map-title"),
  profileMapCopy: byId("profile-map-copy"),
  profileAdvancedTitle: byId("profile-advanced-title"),
  profileAdvancedCopy: byId("profile-advanced-copy"),
  profileCommandName: byId("profile-command-name"),
  profileCommandStatus: byId("profile-command-status"),
  profileCommandFocus: byId("profile-command-focus"),
  profileCommandFocusNote: byId("profile-command-focus-note"),
  profileCommandDirective: byId("profile-command-directive"),
  profileCommandDirectiveNote: byId("profile-command-directive-note")
};

const themeManager = window.netriskTheme || {
  defaultTheme: "command",
  getThemes() {
    return ["command"];
  },
  setThemes(themes) {
    return Array.isArray(themes)
      ? themes
          .map((theme) => (typeof theme === "string" ? theme : String(theme?.id || "")))
          .filter(Boolean)
      : ["command"];
  },
  getCurrentTheme() {
    return document.documentElement.dataset.theme || "command";
  },
  getThemeFromUser() {
    return null;
  },
  applyUserTheme() {
    return this.getCurrentTheme();
  },
  applyTheme(theme) {
    document.documentElement.dataset.theme = theme || "command";
    document.body.dataset.theme = theme || "command";
    return theme || "command";
  }
};

let profileRequestId = 0;
let moduleCatalogRequestId = 0;
let themeOptionsLoaded = false;
let currentSessionUser: PublicUser | null = null;

function setHeaderAuthFeedback(message = ""): void {
  if (!message) {
    window.netriskShell?.clearHeaderAuthFeedback?.();
    return;
  }

  window.netriskShell?.setHeaderAuthFeedback?.(message, "error");
}

function themeLabel(theme: string): string {
  return t(`profile.preferences.theme.${theme}`, {}, { fallback: theme });
}

function setThemeStatus(message: string): void {
  elements.themeStatus.textContent = message;
}

function renderThemeOptions(force = false) {
  if (elements.themeSelect.options.length && !force) {
    return;
  }

  elements.themeSelect.textContent = "";

  themeManager.getThemes().forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = themeLabel(theme);
    elements.themeSelect.appendChild(option);
  });
}

async function loadThemeOptions(): Promise<void> {
  if (themeOptionsLoaded) {
    return;
  }

  try {
    const response = await fetch("/api/game/options");
    const data = (await response.json()) as GameOptionsResponse;
    if (response.ok && Array.isArray(data.themes)) {
      themeManager.setThemes(data.themes.map((theme) => theme.id));
      renderThemeOptions(true);
    }
  } catch (_error: unknown) {
  } finally {
    themeOptionsLoaded = true;
  }
}

function showThemePreferences(isVisible: boolean): void {
  setHidden(elements.profilePreferences, !isVisible);
}

function isAdminUser(user: PublicUser | null | undefined): boolean {
  return Boolean(user && user.role === "admin");
}

function setModuleStatus(message: string): void {
  elements.profileModulesStatus.textContent = message;
}

function showModuleControls(isVisible: boolean): void {
  setHidden(elements.profileModules, !isVisible);
}

function resetModuleControls(): void {
  showModuleControls(false);
  setModuleStatus(t("profile.modules.status.loading"));
  setMarkup(elements.profileModulesList, "");
  setMarkup(elements.profileModuleSlotsList, "");
  setHidden(elements.profileModulesEmpty, true);
  setHidden(elements.profileModuleSlotsEmpty, true);
  setDisabled(elements.profileModulesRefresh, false);
  setDisabled(elements.profileModulesRescan, false);
}

function syncThemePreference({
  announce = false,
  preferredTheme = null
}: { announce?: boolean; preferredTheme?: string | null } = {}): void {
  renderThemeOptions();

  const currentTheme = preferredTheme || themeManager.getCurrentTheme();
  elements.themeSelect.value = currentTheme;
  setThemeStatus(
    announce
      ? t("profile.preferences.status.saved", { theme: themeLabel(currentTheme) })
      : t("profile.preferences.status.current", { theme: themeLabel(currentTheme) })
  );
}

function isNavigationAbort(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return typeof error === "object" && "name" in error && error.name === "AbortError";
}

async function persistThemePreference(theme: string): Promise<ThemePreferenceResponse> {
  const response = await fetch("/api/profile/preferences/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme })
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(translateServerMessage(payload, t("errors.requestFailed")));
  }

  return readValidatedJson(
    response,
    themePreferenceResponseSchema,
    t("profile.preferences.status.saveFailed", { theme: themeLabel(theme) }),
    "ThemePreferenceResponse"
  );
}

function normalizeSessionUser(session: AuthSessionResponse): PublicUser {
  return session.user;
}

function normalizeLoginUser(response: LoginResponse): PublicUser {
  return response.user;
}

async function readSessionResponse(response: Response): Promise<AuthSessionResponse> {
  if (!response.ok) {
    throw new Error(t("profile.errors.loginRequired"));
  }

  return readValidatedJson(
    response,
    authSessionResponseSchema,
    t("profile.errors.loadFailed"),
    "AuthSessionResponse"
  );
}

async function readProfileResponse(response: Response): Promise<ProfileResponse> {
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(translateServerMessage(payload, t("profile.errors.unavailable")));
  }

  return readValidatedJson(
    response,
    profileResponseSchema,
    t("profile.errors.loadFailed"),
    "ProfileResponse"
  );
}

async function readLoginResponse(response: Response): Promise<LoginResponse> {
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(translateServerMessage(payload, t("errors.loginFailed")));
  }

  return readValidatedJson(
    response,
    loginResponseSchema,
    t("errors.loginFailed"),
    "LoginResponse"
  );
}

function renderAuthArea(user: PublicUser | null): void {
  const isAuthenticated = Boolean(user);
  if (isAuthenticated) {
    setHeaderAuthFeedback("");
  }
  if (elements.headerLoginForm) {
    setHidden(elements.headerLoginForm as HTMLElement, isAuthenticated);
    if (elements.headerAuthUsername) {
      setDisabled(elements.headerAuthUsername, isAuthenticated);
    }
    if (elements.headerAuthPassword) {
      setDisabled(elements.headerAuthPassword, isAuthenticated);
    }
    if (elements.headerLoginButton) {
      setDisabled(elements.headerLoginButton, isAuthenticated);
    }
  }
  setHidden(elements.logoutButton, !isAuthenticated);
  setDisabled(elements.logoutButton, !isAuthenticated);
}

function renderNavAvatar(username = "") {
  const avatar = maybeQuery("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

function showFeedback(message: string, tone = "neutral"): void {
  setHidden(elements.profileFeedback, false);
  elements.profileFeedback.textContent = message;
  elements.profileFeedback.className = `profile-feedback${tone === "error" ? " is-error" : ""}`;
  setHidden(elements.profileContent, true);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function moduleKindLabel(kind: string | null | undefined): string {
  if (!kind) {
    return t("profile.modules.kind.unknown");
  }

  return t(`profile.modules.kind.${kind}`, {}, { fallback: kind });
}

function moduleStateLabel(status: string | null | undefined): string {
  if (!status) {
    return t("profile.modules.state.discovered");
  }

  return t(`profile.modules.state.${status}`, {}, { fallback: status });
}

function moduleCompatibilityLabel(moduleEntry: InstalledModuleSummary): string {
  return moduleEntry.compatible
    ? t("profile.modules.state.compatible")
    : t("profile.modules.state.notCompatible");
}

function moduleIssuesLabel(moduleEntry: InstalledModuleSummary): string {
  const issues = [...moduleEntry.errors, ...moduleEntry.warnings].filter(Boolean);
  return issues.length ? issues.join(" | ") : t("profile.modules.issue.none");
}

function renderBadgeList(title: string, values: string[], emptyLabel: string): string {
  return (
    `<div class="profile-mini-lobby">` +
    `<span class="profile-mini-lobby-title">${escapeHtml(title)}</span>` +
    `<div class="profile-game-meta-row">` +
    (values.length
      ? values.map((value) => `<span class="badge">${escapeHtml(value)}</span>`).join("")
      : `<span class="badge">${escapeHtml(emptyLabel)}</span>`) +
    `</div>` +
    `</div>`
  );
}

function moduleDependencyLabel(dependency: NetRiskModuleDependency): string {
  const versionSuffix = dependency.version ? `@${dependency.version}` : "";
  const optionalSuffix = dependency.optional ? ` (${t("profile.modules.optional")})` : "";
  return `${dependency.id}${versionSuffix}${optionalSuffix}`;
}

function moduleCapabilityLabel(capability: NetRiskModuleCapability): string {
  const parts = [capability.kind];
  if (capability.scope) {
    parts.push(capability.scope);
  }
  if (capability.hook) {
    parts.push(capability.hook);
  }
  if (capability.targetId) {
    parts.push(capability.targetId);
  }
  return parts.filter(Boolean).join(" / ");
}

function moduleProfileLabels(moduleEntry: InstalledModuleSummary): string[] {
  const contentProfiles = moduleEntry.clientManifest?.profiles?.content || [];
  const gameplayProfiles = moduleEntry.clientManifest?.profiles?.gameplay || [];
  const uiProfiles = moduleEntry.clientManifest?.profiles?.ui || [];
  return [...contentProfiles, ...gameplayProfiles, ...uiProfiles].map(
    (profile) => profile.name || profile.id
  );
}

function moduleContributionLabels(moduleEntry: InstalledModuleSummary): string[] {
  const labels: string[] = [];
  const presets = moduleEntry.clientManifest?.gamePresets || [];
  const slots = moduleEntry.clientManifest?.ui?.slots || [];
  const stylesheets = moduleEntry.clientManifest?.ui?.stylesheets || [];
  const locales = moduleEntry.clientManifest?.ui?.locales || [];

  presets.forEach((preset) =>
    labels.push(`${t("profile.modules.presets")}: ${preset.name || preset.id}`)
  );
  slots.forEach((slot) =>
    labels.push(`${t("profile.modules.slots")}: ${slot.title || slot.itemId}`)
  );
  stylesheets.forEach((stylesheet) =>
    labels.push(`${t("profile.modules.stylesheets")}: ${stylesheet}`)
  );
  locales.forEach((locale) => labels.push(`${t("profile.modules.locales")}: ${locale}`));

  return labels;
}

function canToggleModule(moduleEntry: InstalledModuleSummary): boolean {
  if (moduleEntry.id === "core.base") {
    return false;
  }

  return moduleEntry.enabled || moduleEntry.compatible;
}

function renderModuleCatalog(modules: InstalledModuleSummary[], engineVersion: string): void {
  showModuleControls(true);
  setModuleStatus(t("profile.modules.status.ready", { count: modules.length, engineVersion }));

  if (!modules.length) {
    setMarkup(elements.profileModulesList, "");
    setHidden(elements.profileModulesEmpty, false);
    return;
  }

  setHidden(elements.profileModulesEmpty, true);
  setMarkup(
    elements.profileModulesList,
    modules
      .map((moduleEntry) => {
        const actionLabel = moduleEntry.enabled
          ? t("profile.modules.action.disable")
          : t("profile.modules.action.enable");
        const detailItems = [
          {
            label: t("profile.modules.detail.version"),
            value: moduleEntry.version || t("common.notAvailable")
          },
          {
            label: t("profile.modules.detail.status"),
            value: moduleStateLabel(moduleEntry.status)
          },
          { label: t("profile.modules.detail.source"), value: moduleEntry.sourcePath },
          {
            label: t("profile.modules.detail.capabilities"),
            value: String(moduleEntry.capabilities.length)
          },
          {
            label: t("profile.modules.detail.dependencies"),
            value: String(moduleEntry.manifest?.dependencies?.length || 0)
          },
          { label: t("profile.modules.detail.issues"), value: moduleIssuesLabel(moduleEntry) }
        ];
        const dependencyLabels = (moduleEntry.manifest?.dependencies || []).map(
          moduleDependencyLabel
        );
        const conflictLabels = (moduleEntry.manifest?.conflicts || []).map((entry) =>
          String(entry || "")
        );
        const capabilityLabels = moduleEntry.capabilities.map((capability) =>
          moduleCapabilityLabel(capability as NetRiskModuleCapability)
        );
        const profileLabels = moduleProfileLabels(moduleEntry);
        const contributionLabels = moduleContributionLabels(moduleEntry);

        return (
          `<article class="profile-note-card">` +
          `<div class="profile-games-head">` +
          `<div>` +
          `<p class="eyebrow profile-section-eyebrow">${escapeHtml(moduleKindLabel(moduleEntry.kind))}</p>` +
          `<h3>${escapeHtml(moduleEntry.displayName)}</h3>` +
          `<p class="stage-copy">${escapeHtml(moduleEntry.description || t("profile.modules.descriptionFallback"))}</p>` +
          `</div>` +
          `<div class="profile-game-meta-row">` +
          `<span class="badge">${escapeHtml(moduleStateLabel(moduleEntry.status))}</span>` +
          `<span class="badge">${escapeHtml(moduleCompatibilityLabel(moduleEntry))}</span>` +
          (moduleEntry.enabled
            ? `<span class="badge">${escapeHtml(t("profile.modules.state.enabled"))}</span>`
            : "") +
          `</div>` +
          `</div>` +
          `<div class="profile-mini-lobby">` +
          `<span class="profile-mini-lobby-title">${escapeHtml(t("profile.modules.details"))}</span>` +
          `<span class="profile-mini-lobby-grid">` +
          detailItems
            .map(
              (item) =>
                `<span class="profile-mini-lobby-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></span>`
            )
            .join("") +
          `</span>` +
          `</div>` +
          renderBadgeList(
            t("profile.modules.dependencies"),
            dependencyLabels,
            t("profile.modules.issue.none")
          ) +
          renderBadgeList(
            t("profile.modules.conflicts"),
            conflictLabels,
            t("profile.modules.issue.none")
          ) +
          renderBadgeList(
            t("profile.modules.capabilities"),
            capabilityLabels,
            t("profile.modules.issue.none")
          ) +
          renderBadgeList(
            t("profile.modules.profiles"),
            profileLabels,
            t("profile.modules.issue.none")
          ) +
          renderBadgeList(
            t("profile.modules.contributions"),
            contributionLabels,
            t("profile.modules.issue.none")
          ) +
          `<div class="profile-game-meta-row">` +
          (canToggleModule(moduleEntry)
            ? `<button type="button" class="ghost-button profile-back-button" data-module-id="${escapeHtml(moduleEntry.id)}" data-module-action="${moduleEntry.enabled ? "disable" : "enable"}">${escapeHtml(actionLabel)}</button>`
            : `<span class="badge">${escapeHtml(t("profile.modules.action.locked"))}</span>`) +
          `</div>` +
          `</article>`
        );
      })
      .join("")
  );
}

function renderAdminModuleSlots(slots: NetRiskUiSlotContribution[]): void {
  if (!slots.length) {
    setMarkup(elements.profileModuleSlotsList, "");
    setHidden(elements.profileModuleSlotsEmpty, false);
    return;
  }

  setHidden(elements.profileModuleSlotsEmpty, true);
  setMarkup(
    elements.profileModuleSlotsList,
    slots
      .map((slot) => {
        const routeMarkup = slot.route
          ? `<a class="ghost-button profile-back-button" href="${escapeHtml(slot.route)}">${escapeHtml(t("profile.modules.extensions.open"))}</a>`
          : "";

        return (
          `<article class="profile-note-card">` +
          `<div class="profile-games-head">` +
          `<div>` +
          `<p class="eyebrow profile-section-eyebrow">${escapeHtml(slot.itemId)}</p>` +
          `<h3>${escapeHtml(slot.title)}</h3>` +
          `<p class="stage-copy">${escapeHtml(slot.description || t("profile.modules.descriptionFallback"))}</p>` +
          `</div>` +
          `<div class="profile-game-meta-row">` +
          `<span class="badge">${escapeHtml(slot.kind)}</span>` +
          routeMarkup +
          `</div>` +
          `</div>` +
          `<div class="profile-mini-lobby">` +
          `<span class="profile-mini-lobby-title">${escapeHtml(t("profile.modules.extensions.details"))}</span>` +
          `<span class="profile-mini-lobby-grid">` +
          `<span class="profile-mini-lobby-item"><span>${escapeHtml(t("profile.modules.extensions.kind"))}</span><strong>${escapeHtml(slot.kind)}</strong></span>` +
          `<span class="profile-mini-lobby-item"><span>${escapeHtml(t("profile.modules.extensions.slot"))}</span><strong>${escapeHtml(slot.slotId)}</strong></span>` +
          `<span class="profile-mini-lobby-item"><span>${escapeHtml(t("profile.modules.extensions.route"))}</span><strong>${escapeHtml(slot.route || t("common.notAvailable"))}</strong></span>` +
          `</span>` +
          `</div>` +
          `</article>`
        );
      })
      .join("")
  );
}

async function loadAdminModuleSlots(): Promise<void> {
  try {
    const response = await fetch("/api/modules/options");
    const payload = (await response.json()) as ModuleOptionsResponse;
    if (!response.ok) {
      throw new Error(translateServerMessage(payload, t("profile.modules.status.error")));
    }

    const adminSlots = Array.isArray(payload.uiSlots)
      ? payload.uiSlots.filter((slot) => slot.slotId === "admin-modules-page")
      : [];
    renderAdminModuleSlots(adminSlots);
  } catch (_error: unknown) {
    setMarkup(elements.profileModuleSlotsList, "");
    setHidden(elements.profileModuleSlotsEmpty, false);
  }
}

async function loadModuleCatalog(
  user: PublicUser | null,
  options: { rescan?: boolean } = {}
): Promise<void> {
  if (!isAdminUser(user)) {
    resetModuleControls();
    return;
  }

  const requestId = ++moduleCatalogRequestId;
  showModuleControls(true);
  setDisabled(elements.profileModulesRefresh, true);
  setDisabled(elements.profileModulesRescan, true);
  setModuleStatus(
    t(options.rescan ? "profile.modules.status.rescanning" : "profile.modules.status.refreshing")
  );

  try {
    const response = await fetch(options.rescan ? "/api/modules/rescan" : "/api/modules", {
      method: options.rescan ? "POST" : "GET",
      headers: options.rescan ? { "Content-Type": "application/json" } : undefined,
      body: options.rescan ? JSON.stringify({}) : undefined
    });
    const payload = (await response.json()) as ModulesCatalogResponse;
    if (!response.ok) {
      throw new Error(translateServerMessage(payload, t("profile.modules.status.error")));
    }

    if (requestId !== moduleCatalogRequestId) {
      return;
    }

    renderModuleCatalog(
      Array.isArray(payload.modules) ? payload.modules : [],
      payload.engineVersion || "-"
    );
    await loadAdminModuleSlots();
    if (options.rescan) {
      setModuleStatus(t("profile.modules.status.rescanned"));
    }
  } catch (error: unknown) {
    if (requestId !== moduleCatalogRequestId) {
      return;
    }

    setModuleStatus(messageFromError(error, t("profile.modules.status.error")));
  } finally {
    if (requestId === moduleCatalogRequestId) {
      setDisabled(elements.profileModulesRefresh, false);
      setDisabled(elements.profileModulesRescan, false);
    }
  }
}

async function toggleModule(
  moduleId: string,
  action: "enable" | "disable",
  user: PublicUser | null
): Promise<void> {
  if (!isAdminUser(user)) {
    resetModuleControls();
    return;
  }

  const requestId = ++moduleCatalogRequestId;
  setDisabled(elements.profileModulesRefresh, true);
  setDisabled(elements.profileModulesRescan, true);
  setModuleStatus(t("profile.modules.status.refreshing"));

  try {
    const response = await fetch(`/api/modules/${encodeURIComponent(moduleId)}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = (await response.json()) as ModulesCatalogResponse;
    if (!response.ok) {
      throw new Error(translateServerMessage(payload, t("profile.modules.status.error")));
    }

    if (requestId !== moduleCatalogRequestId) {
      return;
    }

    renderModuleCatalog(
      Array.isArray(payload.modules) ? payload.modules : [],
      payload.engineVersion || "-"
    );
    await loadAdminModuleSlots();
    setModuleStatus(t("profile.modules.status.updated"));
  } catch (error: unknown) {
    if (requestId !== moduleCatalogRequestId) {
      return;
    }

    setModuleStatus(messageFromError(error, t("profile.modules.status.error")));
  } finally {
    if (requestId === moduleCatalogRequestId) {
      setDisabled(elements.profileModulesRefresh, false);
      setDisabled(elements.profileModulesRescan, false);
    }
  }
}

function phaseLabel(phase: string): string {
  if (phase === "active") {
    return t("common.phase.active");
  }
  if (phase === "finished") {
    return t("common.phase.finished");
  }
  return t("common.phase.lobby");
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

function renderParticipatingGames(profile: ProfileSummary): void {
  const participatingGames: ProfileSummary["participatingGames"] = Array.isArray(
    profile.participatingGames
  )
    ? profile.participatingGames
    : [];
  const count = participatingGames.length;
  const label = t(
    count === 1 ? "profile.games.activeCount.one" : "profile.games.activeCount.other",
    { count }
  );
  elements.gamesCount.textContent = label;

  if (!participatingGames.length) {
    setHidden(elements.gamesEmpty, false);
    setHidden(elements.gamesList, true);
    setMarkup(elements.gamesList, "");
    return;
  }

  setHidden(elements.gamesEmpty, true);
  setHidden(elements.gamesList, false);
  setMarkup(
    elements.gamesList,
    participatingGames
      .map((game) => {
        const lobby = game.myLobby || {};
        return (
          `<button type="button" class="profile-game-row" data-open-game-id="${escapeHtml(game.id)}">` +
          `<span class="profile-game-primary">` +
          `<span class="profile-game-kicker">${t("profile.games.kicker")}</span>` +
          `<span class="profile-game-name">${escapeHtml(game.name)}</span>` +
          `<span class="profile-game-sub">${escapeHtml(game.mapName || game.mapId || t("common.classicMini"))}</span>` +
          `</span>` +
          `<span class="profile-game-meta-row">` +
          `<span class="badge">${phaseLabel(game.phase)}</span>` +
          `<span class="profile-game-meta">${t("profile.games.playerCount", { current: game.playerCount, total: game.totalPlayers || t("common.notAvailable") })}</span>` +
          `<span class="profile-game-meta">${t("profile.games.updatedAt", { updatedAt: formatUpdatedTime(game.updatedAt) })}</span>` +
          `</span>` +
          `<span class="profile-mini-lobby" aria-label="${t("profile.games.personalLobbyAria")}">` +
          `<span class="profile-mini-lobby-title">${t("profile.games.personalLobbyTitle")}</span>` +
          `<span class="profile-mini-lobby-grid">` +
          `<span class="profile-mini-lobby-item"><span>${t("profile.games.commander")}</span><strong>${escapeHtml(lobby.playerName || profile.playerName)}</strong></span>` +
          `<span class="profile-mini-lobby-item"><span>${t("profile.games.status")}</span><strong>${escapeHtml(lobby.statusLabel || t("common.notAvailable"))}</strong></span>` +
          `<span class="profile-mini-lobby-item"><span>${t("profile.games.focus")}</span><strong>${escapeHtml(lobby.focusLabel || t("common.notAvailable"))}</strong></span>` +
          `<span class="profile-mini-lobby-item"><span>${t("profile.games.phase")}</span><strong>${escapeHtml(lobby.turnPhaseLabel || t("common.phase.lobby"))}</strong></span>` +
          `<span class="profile-mini-lobby-item"><span>${t("profile.games.territories")}</span><strong>${Number(lobby.territoryCount || 0)}</strong></span>` +
          `<span class="profile-mini-lobby-item"><span>${t("profile.games.cards")}</span><strong>${Number(lobby.cardCount || 0)}</strong></span>` +
          `</span>` +
          `</span>` +
          `</button>`
        );
      })
      .join("")
  );
}

function showProfile(profile: ProfileSummary): void {
  const participatingGames: ProfileSummary["participatingGames"] = Array.isArray(
    profile.participatingGames
  )
    ? profile.participatingGames
    : [];
  const focusGame = participatingGames[0] || null;
  const knownMaps = participatingGames
    .map((game) => game.mapName || game.mapId)
    .filter((value): value is string => Boolean(value));
  const rankingTitle =
    profile.winRate == null
      ? t("profile.ranks.recruit")
      : profile.winRate >= 70
        ? t("profile.ranks.supremeStrategist")
        : profile.winRate >= 55
          ? t("profile.ranks.armyCommander")
          : profile.winRate >= 40
            ? t("profile.ranks.lineOfficer")
            : t("profile.ranks.recruit");
  const momentum = profile.wins - profile.losses;
  elements.profileName.textContent = profile.playerName;
  if (elements.profileSubtitle) {
    elements.profileSubtitle.textContent = profile.hasHistory
      ? t("profile.runtime.subtitle.withHistory")
      : t("profile.runtime.subtitle.noHistory");
  }
  elements.profileHeading.textContent = profile.playerName;
  elements.profileCopy.textContent = profile.hasHistory
    ? t("profile.runtime.copy.withHistory")
    : t("profile.runtime.copy.noHistory");
  elements.gamesPlayed.textContent = String(profile.gamesPlayed);
  elements.wins.textContent = String(profile.wins);
  elements.losses.textContent = String(profile.losses);
  elements.inProgress.textContent = String(profile.gamesInProgress);
  elements.winRate.textContent = profile.winRate == null ? "--" : `${profile.winRate}%`;
  elements.profileCommandName.textContent = profile.playerName;
  elements.profileCommandStatus.textContent = profile.hasHistory
    ? t("profile.runtime.commandStatus.withHistory", { gamesPlayed: profile.gamesPlayed })
    : t("profile.runtime.commandStatus.noHistory");
  elements.profileCommandFocus.textContent = focusGame ? focusGame.name : t("profile.front.value");
  elements.profileCommandFocusNote.textContent = focusGame
    ? t("profile.runtime.commandFocusNote.active", {
        phase: phaseLabel(focusGame.phase),
        mapName: focusGame.mapName || focusGame.mapId || t("common.classicMini")
      })
    : t("profile.runtime.commandFocusNote.none");
  elements.profileCommandDirective.textContent =
    profile.gamesInProgress > 0
      ? t("profile.runtime.directive.resume")
      : t("profile.runtime.directive.plan");
  elements.profileCommandDirectiveNote.textContent =
    profile.gamesInProgress > 0
      ? t("profile.runtime.directiveNote.active", { count: profile.gamesInProgress })
      : t("profile.runtime.directiveNote.none");
  elements.profileRankingTitle.textContent = rankingTitle;
  elements.profileRankingCopy.textContent =
    profile.gamesPlayed > 0
      ? t("profile.runtime.rankingCopy.withHistory", {
          wins: profile.wins,
          losses: profile.losses,
          winRate: profile.winRate == null ? "--" : `${profile.winRate}%`
        })
      : t("profile.runtime.rankingCopy.noHistory");
  elements.profileMapTitle.textContent = knownMaps[0] || t("profile.map.title");
  elements.profileMapCopy.textContent = knownMaps.length
    ? t("profile.runtime.mapCopy.withHistory", { maps: knownMaps.join(", ") })
    : t("profile.runtime.mapCopy.noHistory");
  elements.profileAdvancedTitle.textContent =
    profile.gamesPlayed > 0
      ? t("profile.runtime.advancedTitle.withHistory", {
          momentum: `${momentum >= 0 ? "+" : ""}${momentum}`
        })
      : t("profile.advanced.title");
  elements.profileAdvancedCopy.textContent =
    profile.gamesPlayed > 0
      ? t("profile.runtime.advancedCopy.withHistory", {
          inProgress: profile.gamesInProgress,
          gamesPlayed: profile.gamesPlayed
        })
      : t("profile.runtime.advancedCopy.noHistory");
  renderParticipatingGames(profile);

  if (!profile.hasHistory) {
    showFeedback(t("profile.runtime.noStats"));
    return;
  }

  setHidden(elements.profileFeedback, true);
  setHidden(elements.profileContent, false);
}

async function loadProfile() {
  const requestId = ++profileRequestId;
  showFeedback(t("profile.feedback"));

  let sessionUser: PublicUser | null = null;

  try {
    const sessionResponse = await fetch("/api/auth/session");
    const session = await readSessionResponse(sessionResponse);
    if (requestId !== profileRequestId) {
      return;
    }
    sessionUser = normalizeSessionUser(session);
    currentSessionUser = sessionUser;
    themeManager.applyUserTheme(sessionUser);
    elements.authStatus.textContent = t("profile.auth.loggedIn", {
      username: sessionUser.username
    });
    renderAuthArea(sessionUser);
    renderNavAvatar(sessionUser.username);
    showThemePreferences(true);
    syncThemePreference({ preferredTheme: themeManager.getThemeFromUser(sessionUser) });
    await loadModuleCatalog(sessionUser);
    const profileResponse = await fetch("/api/profile");
    const payload = await readProfileResponse(profileResponse);
    if (requestId !== profileRequestId) {
      return;
    }
    elements.profileName.textContent = sessionUser.username;
    showProfile(payload.profile);
  } catch (error: unknown) {
    if (requestId !== profileRequestId) {
      return;
    }
    showFeedback(messageFromError(error, t("profile.errors.loadFailed")), "error");
    if (sessionUser) {
      elements.authStatus.textContent = t("profile.auth.loggedIn", {
        username: sessionUser.username
      });
      renderAuthArea(sessionUser);
      renderNavAvatar(sessionUser.username);
      themeManager.applyUserTheme(sessionUser);
      showThemePreferences(true);
      syncThemePreference({ preferredTheme: themeManager.getThemeFromUser(sessionUser) });
      await loadModuleCatalog(sessionUser);
      elements.profileName.textContent = sessionUser.username;
      if (elements.profileSubtitle) {
        elements.profileSubtitle.textContent = t("profile.runtime.temporarilyUnavailable");
      }
      return;
    }

    elements.authStatus.textContent = t("profile.auth.unavailable");
    currentSessionUser = null;
    renderAuthArea(null);
    renderNavAvatar();
    showThemePreferences(false);
    resetModuleControls();
    elements.profileName.textContent = t("profile.runtime.unavailableTitle");
    if (elements.profileSubtitle) {
      elements.profileSubtitle.textContent = t("profile.runtime.unavailableSubtitle");
    }
  }
}

await loadProfile();

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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await readLoginResponse(response);

      if (elements.headerAuthPassword) {
        elements.headerAuthPassword.value = "";
      }
      currentSessionUser = normalizeLoginUser(data);
      await loadProfile();
    } catch (error: unknown) {
      setHeaderAuthFeedback(messageFromError(error, t("errors.loginFailed")));
      renderAuthArea(null);
      renderNavAvatar();
    }
  });
}

elements.logoutButton.addEventListener("click", async () => {
  profileRequestId += 1;
  currentSessionUser = null;
  localStorage.removeItem("frontline-player-id");
  renderAuthArea(null);
  showThemePreferences(false);
  resetModuleControls();
  elements.authStatus.textContent = t("profile.auth.loggedOut");
  renderNavAvatar();
  showFeedback(t("profile.runtime.loggedOutFeedback"), "error");
  elements.profileName.textContent = t("profile.runtime.unavailableTitle");
  if (elements.profileSubtitle) {
    elements.profileSubtitle.textContent = t("profile.runtime.unavailableSubtitle");
  }

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
  } catch (_error: unknown) {}
});

elements.profileModulesRefresh.addEventListener("click", async () => {
  await loadModuleCatalog(currentSessionUser);
});

elements.profileModulesRescan.addEventListener("click", async () => {
  await loadModuleCatalog(currentSessionUser, { rescan: true });
});

elements.profileModulesList.addEventListener("click", async (event) => {
  const trigger = closest<HTMLElement>(event.target, "[data-module-id][data-module-action]");
  if (!trigger) {
    return;
  }

  const moduleId = trigger.dataset.moduleId;
  const action = trigger.dataset.moduleAction;
  if (!moduleId || (action !== "enable" && action !== "disable")) {
    return;
  }

  await toggleModule(moduleId, action, currentSessionUser);
});

await loadThemeOptions();
renderThemeOptions();
syncThemePreference();
elements.themeSelect.addEventListener("change", async () => {
  const previousTheme = themeManager.getCurrentTheme();
  const selectedTheme = elements.themeSelect.value;
  const nextTheme = themeManager.applyTheme(selectedTheme);
  elements.themeSelect.value = nextTheme;
  setDisabled(elements.themeSelect, true);
  setThemeStatus(t("profile.preferences.status.saving", { theme: themeLabel(nextTheme) }));

  try {
    const data = await persistThemePreference(nextTheme);
    const storedTheme = themeManager.getThemeFromUser(data.user) || nextTheme;
    themeManager.applyUserTheme(data.user);
    syncThemePreference({ announce: true, preferredTheme: storedTheme });
  } catch (error: unknown) {
    if (isNavigationAbort(error) || document.visibilityState === "hidden") {
      setThemeStatus(t("profile.preferences.status.current", { theme: themeLabel(nextTheme) }));
      return;
    }

    themeManager.applyTheme(previousTheme);
    elements.themeSelect.value = previousTheme;
    setThemeStatus(
      t("profile.preferences.status.saveFailed", { theme: themeLabel(previousTheme) })
    );
  } finally {
    setDisabled(elements.themeSelect, false);
  }
});

elements.gamesList.addEventListener("click", async (event) => {
  const trigger = closest<HTMLElement>(event.target, "[data-open-game-id]");
  if (!trigger) {
    return;
  }

  const gameId = trigger.dataset.openGameId;
  if (!gameId) {
    return;
  }

  window.location.href = "/game/" + encodeURIComponent(gameId);
});
