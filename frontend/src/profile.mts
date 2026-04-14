import { byId, closest, maybeQuery, setDisabled, setHidden, setMarkup } from "./core/dom.mjs";
import { messageFromError } from "./core/errors.mjs";
import type { ProfileResponse, ProfileSummary, PublicUser, SessionResponse } from "./core/types.mjs";
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

function renderThemeOptions() {
  if (elements.themeSelect.options.length) {
    return;
  }

  themeManager.getThemes().forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = themeLabel(theme);
    elements.themeSelect.appendChild(option);
  });
}

function showThemePreferences(isVisible: boolean): void {
  setHidden(elements.profilePreferences, !isVisible);
}

function syncThemePreference({ announce = false, preferredTheme = null }: { announce?: boolean; preferredTheme?: string | null } = {}): void {
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

  return typeof error === "object"
    && "name" in error
    && error.name === "AbortError";
}

async function persistThemePreference(theme: string): Promise<SessionResponse> {
  const response = await fetch("/api/profile/preferences/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme })
  });
  const data = await response.json() as SessionResponse;
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.requestFailed")));
  }

  return data;
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
  const participatingGames = Array.isArray(profile.participatingGames) ? profile.participatingGames : [];
  const count = participatingGames.length;
  const label = t(count === 1 ? "profile.games.activeCount.one" : "profile.games.activeCount.other", { count });
  elements.gamesCount.textContent = label;

  if (!participatingGames.length) {
    setHidden(elements.gamesEmpty, false);
    setHidden(elements.gamesList, true);
    setMarkup(elements.gamesList, "");
    return;
  }

  setHidden(elements.gamesEmpty, true);
  setHidden(elements.gamesList, false);
  setMarkup(elements.gamesList, participatingGames
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
    .join(""));
}

function showProfile(profile: ProfileSummary): void {
  const participatingGames = Array.isArray(profile.participatingGames) ? profile.participatingGames : [];
  const focusGame = participatingGames[0] || null;
  const knownMaps = participatingGames
    .map((game) => game.mapName || game.mapId)
    .filter((value): value is string => Boolean(value));
  const rankingTitle = profile.winRate == null
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
    ? t("profile.runtime.commandFocusNote.active", { phase: phaseLabel(focusGame.phase), mapName: focusGame.mapName || focusGame.mapId || t("common.classicMini") })
    : t("profile.runtime.commandFocusNote.none");
  elements.profileCommandDirective.textContent = profile.gamesInProgress > 0 ? t("profile.runtime.directive.resume") : t("profile.runtime.directive.plan");
  elements.profileCommandDirectiveNote.textContent = profile.gamesInProgress > 0
    ? t("profile.runtime.directiveNote.active", { count: profile.gamesInProgress })
    : t("profile.runtime.directiveNote.none");
  elements.profileRankingTitle.textContent = rankingTitle;
  elements.profileRankingCopy.textContent = profile.gamesPlayed > 0
    ? t("profile.runtime.rankingCopy.withHistory", { wins: profile.wins, losses: profile.losses, winRate: profile.winRate == null ? "--" : `${profile.winRate}%` })
    : t("profile.runtime.rankingCopy.noHistory");
  elements.profileMapTitle.textContent = knownMaps[0] || t("profile.map.title");
  elements.profileMapCopy.textContent = knownMaps.length
    ? t("profile.runtime.mapCopy.withHistory", { maps: knownMaps.join(", ") })
    : t("profile.runtime.mapCopy.noHistory");
  elements.profileAdvancedTitle.textContent = profile.gamesPlayed > 0
    ? t("profile.runtime.advancedTitle.withHistory", { momentum: `${momentum >= 0 ? "+" : ""}${momentum}` })
    : t("profile.advanced.title");
  elements.profileAdvancedCopy.textContent = profile.gamesPlayed > 0
    ? t("profile.runtime.advancedCopy.withHistory", { inProgress: profile.gamesInProgress, gamesPlayed: profile.gamesPlayed })
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

    if (!sessionResponse.ok) {
      throw new Error(t("profile.errors.loginRequired"));
    }

    const session = await sessionResponse.json() as SessionResponse;
    if (requestId !== profileRequestId) {
      return;
    }
    sessionUser = session.user;
    themeManager.applyUserTheme(session.user);
    elements.authStatus.textContent = t("profile.auth.loggedIn", { username: session.user.username });
    renderAuthArea(session.user);
    renderNavAvatar(session.user.username);
    showThemePreferences(true);
    syncThemePreference({ preferredTheme: themeManager.getThemeFromUser(session.user) });
    const profileResponse = await fetch("/api/profile");

    if (!profileResponse.ok) {
      const payload = await profileResponse.json();
      throw new Error(translateServerMessage(payload, t("profile.errors.unavailable")));
    }

    const payload = await profileResponse.json() as ProfileResponse;
    if (requestId !== profileRequestId) {
      return;
    }
    elements.profileName.textContent = session.user.username;
    showProfile(payload.profile);
  } catch (error: unknown) {
    if (requestId !== profileRequestId) {
      return;
    }
    showFeedback(messageFromError(error, t("profile.errors.loadFailed")), "error");
    if (sessionUser) {
      elements.authStatus.textContent = t("profile.auth.loggedIn", { username: sessionUser.username });
      renderAuthArea(sessionUser);
      renderNavAvatar(sessionUser.username);
      themeManager.applyUserTheme(sessionUser);
      showThemePreferences(true);
      syncThemePreference({ preferredTheme: themeManager.getThemeFromUser(sessionUser) });
      elements.profileName.textContent = sessionUser.username;
      if (elements.profileSubtitle) {
        elements.profileSubtitle.textContent = t("profile.runtime.temporarilyUnavailable");
      }
      return;
    }

    elements.authStatus.textContent = t("profile.auth.unavailable");
    renderAuthArea(null);
    renderNavAvatar();
    showThemePreferences(false);
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
      const data = await response.json() as SessionResponse;
      if (!response.ok) {
        throw new Error(translateServerMessage(data, t("errors.loginFailed")));
      }

      if (elements.headerAuthPassword) {
        elements.headerAuthPassword.value = "";
      }
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
  localStorage.removeItem("frontline-player-id");
  renderAuthArea(null);
  showThemePreferences(false);
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
  } catch (_error: unknown) {
  }
});

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
    setThemeStatus(t("profile.preferences.status.saveFailed", { theme: themeLabel(previousTheme) }));
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
