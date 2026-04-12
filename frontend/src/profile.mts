import { formatDate, t, translateServerMessage } from "./i18n.mts";

const elements = {
  profileName: document.querySelector("#profile-name"),
  profileSubtitle: document.querySelector("#profile-subtitle"),
  headerLoginForm: document.querySelector("#header-login-form"),
  headerAuthUsername: document.querySelector("#header-auth-username"),
  headerAuthPassword: document.querySelector("#header-auth-password"),
  headerLoginButton: document.querySelector("#header-login-button"),
  authStatus: document.querySelector("#auth-status"),
  logoutButton: document.querySelector("#logout-button"),
  profileFeedback: document.querySelector("#profile-feedback"),
  profilePreferences: document.querySelector("#profile-preferences"),
  themeSelect: document.querySelector("#profile-theme-select"),
  themeStatus: document.querySelector("#profile-theme-status"),
  profileContent: document.querySelector("#profile-content"),
  profileHeading: document.querySelector("#profile-heading"),
  profileCopy: document.querySelector("#profile-copy"),
  gamesPlayed: document.querySelector("#metric-games-played"),
  wins: document.querySelector("#metric-wins"),
  losses: document.querySelector("#metric-losses"),
  inProgress: document.querySelector("#metric-in-progress"),
  winRate: document.querySelector("#metric-win-rate"),
  gamesCount: document.querySelector("#profile-games-count"),
  gamesEmpty: document.querySelector("#profile-games-empty"),
  gamesList: document.querySelector("#profile-games-list"),
  profileRankingTitle: document.querySelector("#profile-ranking-title"),
  profileRankingCopy: document.querySelector("#profile-ranking-copy"),
  profileMapTitle: document.querySelector("#profile-map-title"),
  profileMapCopy: document.querySelector("#profile-map-copy"),
  profileAdvancedTitle: document.querySelector("#profile-advanced-title"),
  profileAdvancedCopy: document.querySelector("#profile-advanced-copy"),
  profileCommandName: document.querySelector("#profile-command-name"),
  profileCommandStatus: document.querySelector("#profile-command-status"),
  profileCommandFocus: document.querySelector("#profile-command-focus"),
  profileCommandFocusNote: document.querySelector("#profile-command-focus-note"),
  profileCommandDirective: document.querySelector("#profile-command-directive"),
  profileCommandDirectiveNote: document.querySelector("#profile-command-directive-note")
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

function themeLabel(theme) {
  return t(`profile.preferences.theme.${theme}`, {}, { fallback: theme });
}

function setThemeStatus(message) {
  if (elements.themeStatus) {
    elements.themeStatus.textContent = message;
  }
}

function renderThemeOptions() {
  if (!elements.themeSelect || elements.themeSelect.options.length) {
    return;
  }

  themeManager.getThemes().forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = themeLabel(theme);
    elements.themeSelect.appendChild(option);
  });
}

function showThemePreferences(isVisible) {
  if (!elements.profilePreferences) {
    return;
  }

  elements.profilePreferences.hidden = !isVisible;
}

function syncThemePreference({ announce = false, preferredTheme = null } = {}) {
  renderThemeOptions();

  if (!elements.themeSelect) {
    return;
  }

  const currentTheme = preferredTheme || themeManager.getCurrentTheme();
  elements.themeSelect.value = currentTheme;
  setThemeStatus(
    announce
      ? t("profile.preferences.status.saved", { theme: themeLabel(currentTheme) })
      : t("profile.preferences.status.current", { theme: themeLabel(currentTheme) })
  );
}

function isNavigationAbort(error) {
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

async function persistThemePreference(theme) {
  const response = await fetch("/api/profile/preferences/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("errors.requestFailed")));
  }

  return data;
}

function renderAuthArea(user) {
  const isAuthenticated = Boolean(user);
  if (elements.headerLoginForm) {
    elements.headerLoginForm.hidden = isAuthenticated;
    elements.headerAuthUsername.disabled = isAuthenticated;
    elements.headerAuthPassword.disabled = isAuthenticated;
    elements.headerLoginButton.disabled = isAuthenticated;
  }
  elements.logoutButton.hidden = !isAuthenticated;
  elements.logoutButton.disabled = !isAuthenticated;
}

function renderNavAvatar(username) {
  const avatar = document.querySelector("#nav-avatar");
  if (!avatar) {
    return;
  }

  const label = username ? String(username).trim().charAt(0).toUpperCase() : "C";
  avatar.textContent = label || "C";
}

function showFeedback(message, tone = "neutral") {
  elements.profileFeedback.hidden = false;
  elements.profileFeedback.textContent = message;
  elements.profileFeedback.className = `profile-feedback${tone === "error" ? " is-error" : ""}`;
  elements.profileContent.hidden = true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function renderParticipatingGames(profile) {
  const participatingGames = Array.isArray(profile.participatingGames) ? profile.participatingGames : [];
  const count = participatingGames.length;
  const label = t(count === 1 ? "profile.games.activeCount.one" : "profile.games.activeCount.other", { count });
  elements.gamesCount.textContent = label;

  if (!participatingGames.length) {
    elements.gamesEmpty.hidden = false;
    elements.gamesList.hidden = true;
    elements.gamesList.innerHTML = "";
    return;
  }

  elements.gamesEmpty.hidden = true;
  elements.gamesList.hidden = false;
  elements.gamesList.innerHTML = participatingGames
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
    .join("");
}

function showProfile(profile) {
  const participatingGames = Array.isArray(profile.participatingGames) ? profile.participatingGames : [];
  const focusGame = participatingGames[0] || null;
  const knownMaps = participatingGames
    .map((game) => game.mapName || game.mapId)
    .filter(Boolean);
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

  elements.profileFeedback.hidden = true;
  elements.profileContent.hidden = false;
}

async function loadProfile() {
  const requestId = ++profileRequestId;
  showFeedback(t("profile.feedback"));

  let sessionUser = null;

  try {
    const sessionResponse = await fetch("/api/auth/session");

    if (!sessionResponse.ok) {
      throw new Error(t("profile.errors.loginRequired"));
    }

    const session = await sessionResponse.json();
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

    const payload = await profileResponse.json();
    if (requestId !== profileRequestId) {
      return;
    }
    elements.profileName.textContent = session.user.username;
    showProfile(payload.profile);
  } catch (error) {
    if (requestId !== profileRequestId) {
      return;
    }
    showFeedback(error.message || t("profile.errors.loadFailed"), "error");
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
  elements.headerLoginForm.dataset.headerLoginManaged = "true";
  elements.headerLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = elements.headerAuthUsername.value.trim();
    const password = elements.headerAuthPassword.value;
    if (!username || !password) {
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(translateServerMessage(data, t("errors.loginFailed")));
      }

      elements.headerAuthPassword.value = "";
      await loadProfile();
    } catch (error) {
      showFeedback(error.message || t("errors.loginFailed"), "error");
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
  elements.profileSubtitle.textContent = t("profile.runtime.unavailableSubtitle");

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
  } catch (error) {
  }
});

if (elements.themeSelect) {
  renderThemeOptions();
  syncThemePreference();
  elements.themeSelect.addEventListener("change", async () => {
    const previousTheme = themeManager.getCurrentTheme();
    const selectedTheme = elements.themeSelect.value;
    const nextTheme = themeManager.applyTheme(selectedTheme);
    elements.themeSelect.value = nextTheme;
    elements.themeSelect.disabled = true;
    setThemeStatus(t("profile.preferences.status.saving", { theme: themeLabel(nextTheme) }));

    try {
      const data = await persistThemePreference(nextTheme);
      const storedTheme = themeManager.getThemeFromUser(data.user) || nextTheme;
      themeManager.applyUserTheme(data.user);
      syncThemePreference({ announce: true, preferredTheme: storedTheme });
    } catch (error) {
      if (isNavigationAbort(error) || document.visibilityState === "hidden") {
        setThemeStatus(t("profile.preferences.status.current", { theme: themeLabel(nextTheme) }));
        return;
      }

      themeManager.applyTheme(previousTheme);
      elements.themeSelect.value = previousTheme;
      setThemeStatus(t("profile.preferences.status.saveFailed", { theme: themeLabel(previousTheme) }));
    } finally {
      elements.themeSelect.disabled = false;
    }
  });
}

if (elements.gamesList) {
  elements.gamesList.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-open-game-id]");
    if (!trigger) {
      return;
    }

    const gameId = trigger.dataset.openGameId;
    if (!gameId) {
      return;
    }

    window.location.href = "/game/" + encodeURIComponent(gameId);
  });
}
