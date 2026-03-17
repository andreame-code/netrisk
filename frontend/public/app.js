const state = {
  playerId: localStorage.getItem("frontline-player-id") || null,
  sessionToken: localStorage.getItem("frontline-session-token") || null,
  snapshot: null,
  user: null
};

const mapLayout = {
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
  authStatus: document.querySelector("#auth-status"),
  registerButton: document.querySelector("#register-button"),
  loginButton: document.querySelector("#login-button"),
  logoutButton: document.querySelector("#logout-button"),
  identityStatus: document.querySelector("#identity-status"),
  joinButton: document.querySelector("#join-button"),
  startButton: document.querySelector("#start-button"),
  turnBadge: document.querySelector("#turn-badge"),
  statusSummary: document.querySelector("#status-summary"),
  players: document.querySelector("#players"),
  map: document.querySelector("#map"),
  reinforceSelect: document.querySelector("#reinforce-select"),
  reinforceButton: document.querySelector("#reinforce-button"),
  attackFrom: document.querySelector("#attack-from"),
  attackTo: document.querySelector("#attack-to"),
  attackButton: document.querySelector("#attack-button"),
  conquestGroup: document.querySelector("#conquest-group"),
  conquestArmies: document.querySelector("#conquest-armies"),
  conquestButton: document.querySelector("#conquest-button"),
  fortifyGroup: document.querySelector("#fortify-group"),
  fortifyFrom: document.querySelector("#fortify-from"),
  fortifyTo: document.querySelector("#fortify-to"),
  fortifyArmies: document.querySelector("#fortify-armies"),
  fortifyButton: document.querySelector("#fortify-button"),
  actionHint: document.querySelector("#action-hint"),
  endTurnButton: document.querySelector("#end-turn-button"),
  log: document.querySelector("#log")
};

function ownerById(ownerId) {
  return state.snapshot?.players.find((player) => player.id === ownerId) || null;
}

function territoryById(territoryId) {
  return state.snapshot?.map.find((territory) => territory.id === territoryId) || null;
}

function isCurrentPlayer() {
  return state.snapshot?.currentPlayerId === state.playerId;
}

function myTerritories() {
  return (state.snapshot?.map || []).filter((territory) => territory.ownerId === state.playerId);
}

function setSession(sessionToken, user) {
  state.sessionToken = sessionToken;
  state.user = user;
  if (sessionToken) {
    localStorage.setItem("frontline-session-token", sessionToken);
  } else {
    localStorage.removeItem("frontline-session-token");
  }
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
      const source = mapLayout[territory.id];
      const target = mapLayout[neighborId];
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
      const position = mapLayout[territory.id];
      const classes = [
        "territory-node",
        territory.ownerId === state.playerId ? "is-mine" : "",
        elements.attackFrom.value === territory.id ? "is-source" : "",
        elements.attackTo.value === territory.id ? "is-target" : "",
        elements.reinforceSelect.value === territory.id ? "is-reinforce" : ""
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <button
          type="button"
          class="${classes}"
          data-territory-id="${territory.id}"
          style="left:${position.x}%; top:${position.y}%; --owner-color:${owner?.color || "#9aa6b2"};"
        >
          <span class="territory-name">${territory.name}</span>
          <span class="territory-meta">${owner ? owner.name : "Neutrale"}</span>
          <span class="territory-armies">${territory.armies}</span>
        </button>
      `;
    })
    .join("");

  const details = snapshot.map
    .map((territory) => {
      const owner = ownerById(territory.ownerId);
      return `
        <article class="territory-card">
          <strong>${territory.name}</strong>
          <div>Controllo: ${owner ? owner.name : "neutrale"}</div>
          <div>Armate: ${territory.armies}</div>
          <div>Confini: ${territory.neighbors.join(", ")}</div>
        </article>
      `;
    })
    .join("");

  return `
    <div class="map-board">
      <svg class="map-lines" viewBox="0 0 760 500" aria-hidden="true">${links.join("")}</svg>
      ${nodes}
    </div>
    <div class="map-legend">${details}</div>
  `;
}

function handleTerritoryClick(territoryId) {
  const territory = territoryById(territoryId);
  if (!territory) {
    return;
  }

  if (territory.ownerId === state.playerId) {
    elements.reinforceSelect.value = territory.id;
    elements.attackFrom.value = territory.id;
  } else if (territory.ownerId) {
    const source = territoryById(elements.attackFrom.value) || myTerritories()[0];
    if (source?.neighbors.includes(territory.id)) {
      elements.attackTo.value = territory.id;
    }
  }

  render();
}

function render() {
  const snapshot = state.snapshot;
  const me = snapshot?.players.find((player) => player.id === state.playerId) || null;
  const currentPlayer = snapshot?.players.find((player) => player.id === snapshot.currentPlayerId) || null;
  const winner = snapshot?.players.find((player) => player.id === snapshot.winnerId) || null;

  elements.authStatus.textContent = state.user
    ? `Autenticato come ${state.user.username}. Metodi disponibili: ${state.user.authMethods.join(", ")}.`
    : "Registrati o accedi per entrare nella lobby.";

  elements.identityStatus.textContent = state.user
    ? me
      ? `Connesso alla partita come ${me.name}.`
      : `Accesso attivo come ${state.user.username}. Ora puoi entrare nella lobby.`
    : "Accedi per collegarti alla partita.";

  elements.turnBadge.textContent =
    !snapshot
      ? "Lobby"
      : snapshot.phase === "lobby"
        ? "Lobby"
        : snapshot.phase === "finished"
          ? "Partita conclusa"
          : currentPlayer
            ? `Turno di ${currentPlayer.name}`
            : "In attesa";

  elements.statusSummary.innerHTML = snapshot
    ? `
      <div>Fase: <strong>${snapshot.phase}</strong></div>
      <div>Rinforzi disponibili: <strong>${snapshot.reinforcementPool}</strong></div>
      <div>Vincitore: <strong>${winner ? winner.name : "nessuno"}</strong></div>
    `
    : "<div>Caricamento stato...</div>";

  elements.players.innerHTML = (snapshot?.players || [])
    .map(
      (player) => `
        <article class="player-card">
          <strong>${player.name}</strong>
          <div>Territori: ${player.territoryCount}</div>
          <div>Stato: ${player.eliminated ? "eliminato" : "attivo"}</div>
          <div style="margin-top: 8px; height: 10px; border-radius: 99px; background: ${player.color};"></div>
        </article>
      `
    )
    .join("");

  const territories = myTerritories();
  const reinforceOptions = territories
    .map((territory) => `<option value="${territory.id}">${territoryOptionLabel(territory)}</option>`)
    .join("");
  elements.reinforceSelect.innerHTML = reinforceOptions || '<option value="">Nessun territorio</option>';

  const previousAttackFrom = elements.attackFrom.value;
  elements.attackFrom.innerHTML = reinforceOptions || '<option value="">Nessun territorio</option>';
  if (previousAttackFrom && territories.some((territory) => territory.id === previousAttackFrom)) {
    elements.attackFrom.value = previousAttackFrom;
  }

  const selectedFromId = elements.attackFrom.value || territories[0]?.id || "";
  if (!elements.attackFrom.value && selectedFromId) {
    elements.attackFrom.value = selectedFromId;
  }

  const source = snapshot?.map.find((territory) => territory.id === selectedFromId);
  const attackTargets = (snapshot?.map || []).filter(
    (territory) =>
      source?.neighbors.includes(territory.id) &&
      territory.ownerId &&
      territory.ownerId !== state.playerId
  );

  elements.attackTo.innerHTML =
    attackTargets
      .map((territory) => {
        const owner = ownerById(territory.ownerId);
        return `<option value="${territory.id}">${territory.name} vs ${owner?.name || "?"} (${territory.armies})</option>`;
      })
      .join("") || '<option value="">Nessun bersaglio</option>';

  if (attackTargets.length && !attackTargets.some((territory) => territory.id === elements.attackTo.value)) {
    elements.attackTo.value = attackTargets[0].id;
  }

  const previousFortifyFrom = elements.fortifyFrom.value;
  elements.fortifyFrom.innerHTML = reinforceOptions || '<option value="">Nessun territorio</option>';
  if (previousFortifyFrom && territories.some((territory) => territory.id === previousFortifyFrom)) {
    elements.fortifyFrom.value = previousFortifyFrom;
  }

  const selectedFortifyFromId = elements.fortifyFrom.value || territories[0]?.id || "";
  if (!elements.fortifyFrom.value && selectedFortifyFromId) {
    elements.fortifyFrom.value = selectedFortifyFromId;
  }

  const fortifySource = territoryById(selectedFortifyFromId);
  const fortifyTargets = territories.filter(
    (territory) => territory.id !== selectedFortifyFromId && fortifySource?.neighbors.includes(territory.id)
  );

  elements.fortifyTo.innerHTML =
    fortifyTargets
      .map((territory) => `<option value="${territory.id}">${territoryOptionLabel(territory)}</option>`)
      .join("") || '<option value="">Nessun territorio adiacente</option>';

  if (fortifyTargets.length && !fortifyTargets.some((territory) => territory.id === elements.fortifyTo.value)) {
    elements.fortifyTo.value = fortifyTargets[0].id;
  }

  if (fortifySource && elements.fortifyArmies && !elements.fortifyArmies.value) {
    elements.fortifyArmies.value = "1";
  }

  elements.map.innerHTML = snapshot ? buildGraphMarkup(snapshot) : "";
  elements.log.innerHTML = (snapshot?.log || []).map((entry) => `<li>${entry}</li>`).join("");

  const canInteract = Boolean(me) && snapshot?.phase === "active" && isCurrentPlayer();
  const pendingConquest = snapshot?.pendingConquest || null;
  elements.registerButton.disabled = Boolean(state.user);
  elements.loginButton.disabled = Boolean(state.user);
  elements.logoutButton.disabled = !state.user;
  elements.joinButton.disabled = !state.user || Boolean(me) || snapshot?.phase !== "lobby";
  elements.startButton.disabled = !me || snapshot?.phase !== "lobby" || snapshot.players.length < 2;
  if (elements.conquestGroup) {
    elements.conquestGroup.hidden = !pendingConquest;
  }
  if (elements.fortifyGroup) {
    elements.fortifyGroup.hidden = snapshot?.turnPhase !== "fortify" || Boolean(pendingConquest);
  }
  if (pendingConquest && elements.conquestArmies) {
    elements.conquestArmies.min = String(pendingConquest.minArmies || 1);
    elements.conquestArmies.max = String(pendingConquest.maxArmies || pendingConquest.minArmies || 1);
    if (!elements.conquestArmies.value) {
      elements.conquestArmies.value = String(pendingConquest.minArmies || 1);
    }
  }

  const inReinforcement = snapshot?.turnPhase === "reinforcement";
  const inAttack = snapshot?.turnPhase === "attack";
  const inFortify = snapshot?.turnPhase === "fortify";
  elements.reinforceButton.disabled = !canInteract || !inReinforcement || Boolean(pendingConquest) || snapshot.reinforcementPool <= 0 || !elements.reinforceSelect.value;
  elements.attackButton.disabled = !canInteract || !inAttack || Boolean(pendingConquest) || snapshot.reinforcementPool > 0 || !elements.attackFrom.value || !elements.attackTo.value;
  elements.conquestButton.disabled = !canInteract || !pendingConquest || !elements.conquestArmies.value;
  elements.fortifyButton.disabled = !canInteract || !inFortify || snapshot.fortifyUsed || !elements.fortifyFrom.value || !elements.fortifyTo.value || !elements.fortifyArmies.value;
  elements.endTurnButton.disabled = !canInteract || inReinforcement || Boolean(pendingConquest);
  elements.endTurnButton.textContent = inAttack ? "Vai a fortifica" : "Termina turno";
  elements.actionHint.textContent = canInteract
    ? pendingConquest
      ? "Sposta armate dopo la conquista"
      : inReinforcement
        ? "Distribuisci rinforzi"
        : inFortify
          ? snapshot.fortifyUsed
            ? "Puoi terminare il turno"
            : "Puoi fortificare o terminare il turno"
          : "Puoi attaccare o passare alla fortifica"
    : state.user
      ? "Osservazione"
      : "Login richiesto";
}

async function send(path, payload = {}, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.sessionToken) {
    headers["x-session-token"] = state.sessionToken;
  }

  const response = await fetch(path, {
    method: options.method || "POST",
    headers,
    body: options.method === "GET" ? undefined : JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Richiesta fallita.");
  }
  return data;
}

async function loadState() {
  const response = await fetch("/api/state");
  state.snapshot = await response.json();
  render();
}

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
    setSession(null, null);
    clearPlayerIdentity();
  }

  render();
}

function connectEvents() {
  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    state.snapshot = JSON.parse(event.data);
    render();
  };
}

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = elements.authUsername.value.trim();
  const password = elements.authPassword.value;
  if (!username || !password) {
    return;
  }

  try {
    const data = await send("/api/auth/login", { username, password });
    setSession(data.sessionToken, data.user);
    clearPlayerIdentity();
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.registerButton.addEventListener("click", async () => {
  const username = elements.authUsername.value.trim();
  const password = elements.authPassword.value;
  if (!username || !password) {
    return;
  }

  try {
    await send("/api/auth/register", { username, password });
    const login = await send("/api/auth/login", { username, password });
    setSession(login.sessionToken, login.user);
    clearPlayerIdentity();
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await send("/api/auth/logout", { sessionToken: state.sessionToken });
  } catch (error) {
  }

  setSession(null, null);
  clearPlayerIdentity();
  render();
});

elements.joinButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/join", { sessionToken: state.sessionToken });
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
      sessionToken: state.sessionToken,
      playerId: state.playerId
    });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.reinforceButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      sessionToken: state.sessionToken,
      playerId: state.playerId,
      type: "reinforce",
      territoryId: elements.reinforceSelect.value
    });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.attackFrom.addEventListener("change", () => render());
elements.fortifyFrom.addEventListener("change", () => render());
elements.map.addEventListener("click", (event) => {
  const button = event.target.closest("[data-territory-id]");
  if (!button) {
    return;
  }

  handleTerritoryClick(button.dataset.territoryId);
});

elements.attackButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      sessionToken: state.sessionToken,
      playerId: state.playerId,
      type: "attack",
      fromId: elements.attackFrom.value,
      toId: elements.attackTo.value
    });
    state.snapshot = data.state;
    if (!state.snapshot.pendingConquest && elements.conquestArmies) {
      elements.conquestArmies.value = "";
    }
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.conquestButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
      sessionToken: state.sessionToken,
      playerId: state.playerId,
      type: "moveAfterConquest",
      armies: Number(elements.conquestArmies.value)
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
      sessionToken: state.sessionToken,
      playerId: state.playerId,
      type: "fortify",
      fromId: elements.fortifyFrom.value,
      toId: elements.fortifyTo.value,
      armies: Number(elements.fortifyArmies.value)
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
      sessionToken: state.sessionToken,
      playerId: state.playerId,
      type: "endTurn"
    });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

await loadState();
await restoreSession();
connectEvents();




