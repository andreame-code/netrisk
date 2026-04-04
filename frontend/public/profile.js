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
  gamesList: document.querySelector("#profile-games-list")
};

let profileRequestId = 0;

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
    return "In corso";
  }
  if (phase === "finished") {
    return "Conclusa";
  }
  return "Lobby";
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

function renderParticipatingGames(profile) {
  const participatingGames = Array.isArray(profile.participatingGames) ? profile.participatingGames : [];
  const label = participatingGames.length === 1 ? "1 attiva" : `${participatingGames.length} attive`;
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
          `<span class="profile-game-kicker">Partita</span>` +
          `<span class="profile-game-name">${escapeHtml(game.name)}</span>` +
          `<span class="profile-game-sub">ID ${escapeHtml(game.id)}</span>` +
        `</span>` +
        `<span class="profile-game-meta-row">` +
          `<span class="badge">${phaseLabel(game.phase)}</span>` +
          `<span class="profile-game-meta">${escapeHtml(game.mapName || "Mappa non definita")}</span>` +
          `<span class="profile-game-meta">${game.playerCount}/${game.totalPlayers || "n/d"} giocatori</span>` +
          `<span class="profile-game-meta">Aggiornata ${formatUpdatedTime(game.updatedAt)}</span>` +
        `</span>` +
        `<span class="profile-mini-lobby" aria-label="Mini lobby personale">` +
          `<span class="profile-mini-lobby-title">Mini lobby personale</span>` +
          `<span class="profile-mini-lobby-grid">` +
            `<span class="profile-mini-lobby-item"><span>Comandante</span><strong>${escapeHtml(lobby.playerName || profile.playerName)}</strong></span>` +
            `<span class="profile-mini-lobby-item"><span>Stato</span><strong>${escapeHtml(lobby.statusLabel || "n/d")}</strong></span>` +
            `<span class="profile-mini-lobby-item"><span>Focus</span><strong>${escapeHtml(lobby.focusLabel || "n/d")}</strong></span>` +
            `<span class="profile-mini-lobby-item"><span>Fase</span><strong>${escapeHtml(lobby.turnPhaseLabel || "Lobby")}</strong></span>` +
            `<span class="profile-mini-lobby-item"><span>Territori</span><strong>${Number(lobby.territoryCount || 0)}</strong></span>` +
            `<span class="profile-mini-lobby-item"><span>Carte</span><strong>${Number(lobby.cardCount || 0)}</strong></span>` +
          `</span>` +
        `</span>` +
      `</button>`
      );
    })
    .join("");
}

function showProfile(profile) {
  elements.profileName.textContent = profile.playerName;
  if (elements.profileSubtitle) {
    elements.profileSubtitle.textContent = profile.hasHistory
      ? "Record operativo delle campagne completate e delle sessioni ancora aperte."
      : "Nessuna campagna registrata per questo comandante, ma il profilo e pronto a crescere.";
  }
  elements.profileHeading.textContent = profile.playerName;
  elements.profileCopy.textContent = profile.hasHistory
    ? "Una lettura rapida del rendimento complessivo, mantenendo la pagina pronta per espansioni future."
    : "Il comandante non ha ancora uno storico completo. Avvia o completa una partita per popolare il dossier.";
  elements.gamesPlayed.textContent = String(profile.gamesPlayed);
  elements.wins.textContent = String(profile.wins);
  elements.losses.textContent = String(profile.losses);
  elements.inProgress.textContent = String(profile.gamesInProgress);
  elements.winRate.textContent = profile.winRate == null ? "--" : `${profile.winRate}%`;
  renderParticipatingGames(profile);

  if (!profile.hasHistory) {
    showFeedback("Nessuna statistica disponibile: completa almeno una partita per costruire il record.");
    return;
  }

  elements.profileFeedback.hidden = true;
  elements.profileContent.hidden = false;
}

async function loadProfile() {
  const requestId = ++profileRequestId;
  showFeedback("Caricamento dati giocatore...");

  let sessionUser = null;

  try {
    const sessionResponse = await fetch("/api/auth/session");

    if (!sessionResponse.ok) {
      throw new Error("Accedi prima di consultare il profilo giocatore.");
    }

    const session = await sessionResponse.json();
    if (requestId !== profileRequestId) {
      return;
    }
    sessionUser = session.user;
    elements.authStatus.textContent = "Autenticato come " + session.user.username + ".";
    renderAuthArea(session.user);
    renderNavAvatar(session.user.username);
    const profileResponse = await fetch("/api/profile");

    if (!profileResponse.ok) {
      const payload = await profileResponse.json();
      throw new Error(payload.error || "Profilo non disponibile.");
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
    showFeedback(error.message || "Impossibile caricare il profilo.", "error");
    if (sessionUser) {
      elements.authStatus.textContent = "Autenticato come " + sessionUser.username + ".";
      renderAuthArea(sessionUser);
      renderNavAvatar(sessionUser.username);
      elements.profileName.textContent = sessionUser.username;
      if (elements.profileSubtitle) {
        elements.profileSubtitle.textContent = "Profilo temporaneamente non disponibile.";
      }
      return;
    }

    elements.authStatus.textContent = "Sessione non disponibile.";
    renderAuthArea(null);
    renderNavAvatar();
    elements.profileName.textContent = "Profilo non disponibile";
    if (elements.profileSubtitle) {
      if (elements.profileSubtitle) {
    elements.profileSubtitle.textContent = "Verifica la sessione o riprova piu tardi.";
  }
    }
  }
}

await loadProfile();


if (elements.headerLoginForm) {
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
        throw new Error(data.error || "Accesso non riuscito.");
      }

      elements.headerAuthPassword.value = "";
      await loadProfile();
    } catch (error) {
      showFeedback(error.message || "Accesso non riuscito.", "error");
      renderAuthArea(null);
      renderNavAvatar();
    }
  });
}

elements.logoutButton.addEventListener("click", async () => {
  profileRequestId += 1;
  localStorage.removeItem("frontline-player-id");
  renderAuthArea(null);
  elements.authStatus.textContent = "Sessione terminata.";
  renderNavAvatar();
  showFeedback("Sessione chiusa. Accedi di nuovo dalla pagina Game per consultare il profilo.", "error");
  elements.profileName.textContent = "Profilo non disponibile";
  elements.profileSubtitle.textContent = "Verifica la sessione o riprova piu tardi.";

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
