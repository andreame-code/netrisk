const elements = {
  profileName: document.querySelector("#profile-name"),
  profileSubtitle: document.querySelector("#profile-subtitle"),
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
  showFeedback("Caricamento dati giocatore...");

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
    elements.profileName.textContent = session.user.username;
    showProfile(payload.profile);
  } catch (error) {
    showFeedback(error.message || "Impossibile caricare il profilo.", "error");
    elements.profileName.textContent = "Profilo non disponibile";
    elements.profileSubtitle.textContent = "Verifica la sessione o riprova piu tardi.";
  }
}

await loadProfile();
