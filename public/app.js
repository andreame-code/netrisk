const state = {
  playerId: localStorage.getItem("frontline-player-id") || null,
  playerName: localStorage.getItem("frontline-player-name") || "",
  snapshot: null
};

const mapLayout = {
  aurora: { x: 130, y: 90 },
  bastion: { x: 310, y: 70 },
  cinder: { x: 210, y: 195 },
  delta: { x: 110, y: 315 },
  ember: { x: 385, y: 215 },
  forge: { x: 535, y: 125 },
  grove: { x: 260, y: 420 },
  harbor: { x: 470, y: 335 },
  ion: { x: 655, y: 250 }
};

const elements = {
  joinForm: document.querySelector("#join-form"),
  playerName: document.querySelector("#player-name"),
  identityStatus: document.querySelector("#identity-status"),
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
  actionHint: document.querySelector("#action-hint"),
  endTurnButton: document.querySelector("#end-turn-button"),
  log: document.querySelector("#log")
};

elements.playerName.value = state.playerName;

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

function setIdentity(playerId, playerName) {
  state.playerId = playerId;
  state.playerName = playerName;
  localStorage.setItem("frontline-player-id", playerId);
  localStorage.setItem("frontline-player-name", playerName);
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
        <line
          x1="${source.x}"
          y1="${source.y}"
          x2="${target.x}"
          y2="${target.y}"
          class="map-link"
        />
      `);
    });
  });

  const nodes = snapshot.map
    .map((territory) => {
      const owner = ownerById(territory.ownerId);
      const position = mapLayout[territory.id];
      const isMine = territory.ownerId === state.playerId;
      const isActiveSource = elements.attackFrom.value === territory.id;
      const isAttackTarget = elements.attackTo.value === territory.id;
      const isReinforceTarget = elements.reinforceSelect.value === territory.id;
      const classes = [
        "territory-node",
        isMine ? "is-mine" : "",
        isActiveSource ? "is-source" : "",
        isAttackTarget ? "is-target" : "",
        isReinforceTarget ? "is-reinforce" : ""
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <button
          type="button"
          class="${classes}"
          data-territory-id="${territory.id}"
          style="left:${position.x}px; top:${position.y}px; --owner-color:${owner?.color || "#9aa6b2"};"
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
      <svg class="map-lines" viewBox="0 0 760 500" aria-hidden="true">
        ${links.join("")}
      </svg>
      ${nodes}
    </div>
    <div class="map-legend">
      ${details}
    </div>
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
  if (!snapshot) {
    return;
  }

  const currentPlayer = snapshot.players.find((player) => player.id === snapshot.currentPlayerId);
  const me = snapshot.players.find((player) => player.id === state.playerId);
  elements.identityStatus.textContent = me
    ? `Connesso come ${me.name}. Apri questa pagina anche da altri browser per simulare altri giocatori.`
    : "Scegli un nome e collegati alla lobby.";

  elements.turnBadge.textContent =
    snapshot.phase === "lobby"
      ? "Lobby"
      : snapshot.phase === "finished"
        ? "Partita conclusa"
        : currentPlayer
          ? `Turno di ${currentPlayer.name}`
          : "In attesa";

  const winner = snapshot.players.find((player) => player.id === snapshot.winnerId);
  elements.statusSummary.innerHTML = `
    <div>Fase: <strong>${snapshot.phase}</strong></div>
    <div>Rinforzi disponibili: <strong>${snapshot.reinforcementPool}</strong></div>
    <div>Vincitore: <strong>${winner ? winner.name : "nessuno"}</strong></div>
  `;

  elements.players.innerHTML = snapshot.players
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

  const source = snapshot.map.find((territory) => territory.id === selectedFromId);
  const attackTargets = snapshot.map.filter(
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

  elements.map.innerHTML = buildGraphMarkup(snapshot);

  const canInteract = Boolean(me) && snapshot.phase === "active" && isCurrentPlayer();
  elements.startButton.disabled = !me || snapshot.phase !== "lobby" || snapshot.players.length < 2;
  elements.reinforceButton.disabled =
    !canInteract || snapshot.reinforcementPool <= 0 || !elements.reinforceSelect.value;
  elements.attackButton.disabled =
    !canInteract || snapshot.reinforcementPool > 0 || !elements.attackFrom.value || !elements.attackTo.value;
  elements.endTurnButton.disabled = !canInteract || snapshot.reinforcementPool > 0;
  elements.actionHint.textContent = canInteract
    ? snapshot.reinforcementPool > 0
      ? "Distribuisci rinforzi"
      : "Puoi attaccare o chiudere il turno"
    : "Osservazione";

  elements.log.innerHTML = snapshot.log.map((entry) => `<li>${entry}</li>`).join("");
}

async function send(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
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

function connectEvents() {
  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    state.snapshot = JSON.parse(event.data);
    render();
  };
}

elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.playerName.value.trim();
  if (!name) {
    return;
  }

  try {
    const data = await send("/api/join", { name });
    setIdentity(data.playerId, name);
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.startButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/start", { playerId: state.playerId });
    state.snapshot = data.state;
    render();
  } catch (error) {
    alert(error.message);
  }
});

elements.reinforceButton.addEventListener("click", async () => {
  try {
    const data = await send("/api/action", {
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
      playerId: state.playerId,
      type: "attack",
      fromId: elements.attackFrom.value,
      toId: elements.attackTo.value
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
connectEvents();
