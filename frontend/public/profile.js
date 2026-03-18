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
  winRate: document.querySelector("#metric-win-rate")
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

function showProfile(profile) {
  elements.profileName.textContent = profile.playerName;
  elements.profileSubtitle.textContent = profile.hasHistory
    ? "Record operativo delle campagne completate e delle sessioni ancora aperte."
    : "Nessuna campagna registrata per questo comandante, ma il profilo e pronto a crescere.";
  elements.profileHeading.textContent = profile.playerName;
  elements.profileCopy.textContent = profile.hasHistory
    ? "Una lettura rapida del rendimento complessivo, mantenendo la pagina pronta per espansioni future."
    : "Il comandante non ha ancora uno storico completo. Avvia o completa una partita per popolare il dossier.";
  elements.gamesPlayed.textContent = String(profile.gamesPlayed);
  elements.wins.textContent = String(profile.wins);
  elements.losses.textContent = String(profile.losses);
  elements.inProgress.textContent = String(profile.gamesInProgress);
  elements.winRate.textContent = profile.winRate == null ? "--" : `${profile.winRate}%`;

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
    const sessionToken = localStorage.getItem("frontline-session-token") || "";
    const sessionResponse = await fetch("/api/auth/session", {
      headers: {
        "x-session-token": sessionToken
      }
    });

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
    const profileResponse = await fetch("/api/profile", {
      headers: {
        "x-session-token": sessionToken
      }
    });

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
      elements.profileSubtitle.textContent = "Profilo temporaneamente non disponibile.";
      return;
    }

    elements.authStatus.textContent = "Sessione non disponibile.";
    renderAuthArea(null);
    renderNavAvatar();
    elements.profileName.textContent = "Profilo non disponibile";
    elements.profileSubtitle.textContent = "Verifica la sessione o riprova piu tardi.";
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

      localStorage.setItem("frontline-session-token", data.sessionToken);
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
  const sessionToken = localStorage.getItem("frontline-session-token") || "";

  localStorage.removeItem("frontline-session-token");
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
      body: JSON.stringify({ sessionToken })
    });
  } catch (error) {
  }
});
